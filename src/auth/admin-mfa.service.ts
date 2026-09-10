import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { createTransport, type Transporter } from 'nodemailer';
import { Repository } from 'typeorm';
import { Vendedor } from '../models/vendedores/entities/vendedore.entity';

const CHALLENGE_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 30;

@Injectable()
export class AdminMfaService {
  private readonly enabled: boolean;
  private readonly secret: string | undefined;
  private readonly from: string | undefined;
  private readonly transporter: Transporter | null;

  constructor(
    @InjectRepository(Vendedor)
    private readonly vendedoresRepository: Repository<Vendedor>,
    private readonly config: ConfigService,
  ) {
    this.enabled =
      this.config.get<string>('ADMIN_EMAIL_MFA_ENABLED') === 'true';
    this.secret = this.config.get<string>('MFA_SECRET');
    this.from = this.config.get<string>('SMTP_FROM');

    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const password = this.config.get<string>('SMTP_PASSWORD');
    this.transporter =
      this.enabled && host
        ? createTransport({
            host,
            port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
            secure: this.config.get<string>('SMTP_SECURE') === 'true',
            requireTLS: this.config.get<string>('SMTP_REQUIRE_TLS') !== 'false',
            auth: user && password ? { user, pass: password } : undefined,
          })
        : null;
  }

  isEnabled() {
    return this.enabled;
  }

  async createChallenge(vendedor: Vendedor, passwordChangeRequired: boolean) {
    if (!this.transporter || !this.secret || !this.from) {
      throw new ServiceUnavailableException(
        'La autenticación por correo no está configurada',
      );
    }

    const existingIssuedAt = vendedor.adminMfaExpiresAt
      ? vendedor.adminMfaExpiresAt.getTime() - CHALLENGE_MINUTES * 60_000
      : 0;
    if (
      vendedor.adminMfaChallengeId &&
      vendedor.adminMfaExpiresAt &&
      vendedor.adminMfaExpiresAt.getTime() > Date.now() &&
      Date.now() - existingIssuedAt < RESEND_COOLDOWN_SECONDS * 1_000
    ) {
      return {
        challengeId: vendedor.adminMfaChallengeId,
        emailMasked: this.maskEmail(vendedor.email),
        expiresInSeconds: Math.max(
          1,
          Math.ceil(
            (vendedor.adminMfaExpiresAt.getTime() - Date.now()) / 1_000,
          ),
        ),
      };
    }

    const challengeId = randomUUID();
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    vendedor.adminMfaChallengeId = challengeId;
    vendedor.adminMfaCodeHash = this.hashCode(challengeId, code);
    vendedor.adminMfaExpiresAt = new Date(
      Date.now() + CHALLENGE_MINUTES * 60_000,
    );
    vendedor.adminMfaAttempts = 0;
    vendedor.passwordChangeRequired = passwordChangeRequired;
    await this.vendedoresRepository.save(vendedor);

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: vendedor.email,
        subject: 'Código de acceso administrativo',
        text:
          `Tu código de acceso es ${code}. ` +
          `Vence en ${CHALLENGE_MINUTES} minutos y puede utilizarse una sola vez. ` +
          'Si no intentaste ingresar, informalo al área de sistemas.',
        html:
          '<p>Se solicitó acceso a una cuenta administradora.</p>' +
          `<p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>` +
          `<p>El código vence en ${CHALLENGE_MINUTES} minutos y puede utilizarse una sola vez.</p>` +
          '<p>Si no intentaste ingresar, informalo al área de sistemas.</p>',
      });
    } catch {
      vendedor.adminMfaChallengeId = null;
      vendedor.adminMfaCodeHash = null;
      vendedor.adminMfaExpiresAt = null;
      vendedor.adminMfaAttempts = 0;
      await this.vendedoresRepository.save(vendedor);
      throw new ServiceUnavailableException(
        'No se pudo enviar el código de acceso',
      );
    }

    return {
      challengeId,
      emailMasked: this.maskEmail(vendedor.email),
      expiresInSeconds: CHALLENGE_MINUTES * 60,
    };
  }

  async verifyChallenge(challengeId: string, code: string) {
    if (!this.enabled || !this.secret) {
      throw new UnauthorizedException('Código inválido o vencido');
    }

    const codeHash = this.hashCode(challengeId, code);
    const consumed = await this.vendedoresRepository
      .createQueryBuilder()
      .update(Vendedor)
      .set({
        adminMfaChallengeId: null,
        adminMfaCodeHash: null,
        adminMfaExpiresAt: null,
        adminMfaAttempts: 0,
      })
      .where('admin_mfa_challenge_id = :challengeId', { challengeId })
      .andWhere('admin_mfa_code_hash = :codeHash', { codeHash })
      .andWhere('admin_mfa_expires_at > NOW()')
      .andWhere('admin_mfa_attempts < :maxAttempts', {
        maxAttempts: MAX_ATTEMPTS,
      })
      .andWhere("rol = 'administrador'")
      .andWhere("estado_solicitud = 'aprobado'")
      .returning('id')
      .execute();

    if (consumed.affected === 1) {
      const id = Number((consumed.raw as Array<{ id: number }>)[0]?.id);
      const vendedor = await this.vendedoresRepository.findOne({
        where: { id },
      });
      if (vendedor) return vendedor;
    }

    await this.vendedoresRepository
      .createQueryBuilder()
      .update(Vendedor)
      .set({ adminMfaAttempts: () => 'admin_mfa_attempts + 1' })
      .where('admin_mfa_challenge_id = :challengeId', { challengeId })
      .andWhere('admin_mfa_expires_at > NOW()')
      .andWhere('admin_mfa_attempts < :maxAttempts', {
        maxAttempts: MAX_ATTEMPTS,
      })
      .execute();
    throw new UnauthorizedException('Código inválido o vencido');
  }

  private hashCode(challengeId: string, code: string) {
    return createHmac('sha256', this.secret as string)
      .update(`admin-email-mfa:${challengeId}:${code}`)
      .digest('hex');
  }

  private maskEmail(email: string) {
    const [local, domain] = email.split('@');
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
  }
}
