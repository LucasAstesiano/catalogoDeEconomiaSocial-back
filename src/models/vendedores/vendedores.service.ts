import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ILike, Not, Repository } from 'typeorm';
import { PasswordService } from '../../auth/password.service';
import { CreateVendedoreDto } from './dto/create-vendedore.dto';
import { UpdateVendedoreDto } from './dto/update-vendedore.dto';
import { LoginVendedoreDto } from './dto/login-vendedore.dto';
import { Vendedor } from './entities/vendedore.entity';
import { AdminMfaService } from '../../auth/admin-mfa.service';

@Injectable()
export class VendedoresService {
  private static readonly DUMMY_PASSWORD_HASH =
    '$argon2id$v=19$m=65536,p=1,t=3$I6AuZQ2Sm3+HCUZW+UQe6w$u5EhQsZPLV0McSJpWtsCJbao46OHQonWb0v+Z/x4yZ8';

  private normalizarRedes(valor: unknown) {
    if (!Array.isArray(valor)) return [];
    return valor.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const { tipo, url } = item as { tipo?: unknown; url?: unknown };
      if (
        !['facebook', 'instagram'].includes(String(tipo)) ||
        typeof url !== 'string' ||
        !/^https?:\/\//i.test(url.trim())
      )
        return [];
      return [
        {
          tipo: tipo as 'facebook' | 'instagram',
          url: url.trim(),
        },
      ];
    });
  }

  private normalizarWhatsapp(valor: string | null | undefined) {
    if (!valor) return null;
    const digitos = valor.replace(/\D/g, '');
    return /^549\d{10}$/.test(digitos) ? digitos : null;
  }

  constructor(
    @InjectRepository(Vendedor)
    private readonly vendedoresRepository: Repository<Vendedor>,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly adminMfaService: AdminMfaService,
  ) {}

  private sanitize(vendedor: Vendedor) {
    return {
      id: vendedor.id,
      rol: vendedor.rol,
      estadoSolicitud: vendedor.estadoSolicitud,
      nombre: vendedor.nombre,
      email: vendedor.email,
      ruess: vendedor.ruess,
      esMonotributista: vendedor.esMonotributista,
      descripcionNegocio: vendedor.descripcionNegocio,
      integrantesEquipo: vendedor.integrantesEquipo ?? [],
      ubicacion: vendedor.ubicacion,
      whatsapp: vendedor.whatsapp,
      telefono: vendedor.telefono,
      logoUrl: vendedor.logoUrl,
      redesSociales: this.normalizarRedes(vendedor.redesSociales),
    };
  }

  private sanitizePublic(vendedor: Vendedor) {
    return {
      id: vendedor.id,
      nombre: vendedor.nombre,
      email: vendedor.email,
      ruess: vendedor.ruess,
      descripcionNegocio: vendedor.descripcionNegocio,
      integrantesEquipo: vendedor.integrantesEquipo ?? [],
      ubicacion: vendedor.ubicacion,
      whatsapp: vendedor.whatsapp,
      telefono: vendedor.telefono,
      logoUrl: vendedor.logoUrl,
      redesSociales: this.normalizarRedes(vendedor.redesSociales),
    };
  }

  async create(createVendedoreDto: CreateVendedoreDto) {
    const email = createVendedoreDto.email.trim().toLowerCase();
    const found = await this.vendedoresRepository.findOne({
      where: { email },
    });
    if (found) {
      throw new ConflictException('El email ya existe');
    }

    const created = this.vendedoresRepository.create({
      nombre: createVendedoreDto.nombre,
      email,
      rol: 'usuario',
      estadoSolicitud: 'pendiente',
      ruess: createVendedoreDto.ruess ?? null,
      esMonotributista: createVendedoreDto.esMonotributista ?? null,
      descripcionNegocio: createVendedoreDto.descripcionNegocio ?? null,
      integrantesEquipo: createVendedoreDto.integrantesEquipo ?? [],
      ubicacion: createVendedoreDto.ubicacion ?? null,
      whatsapp: this.normalizarWhatsapp(createVendedoreDto.whatsapp),
      telefono: createVendedoreDto.telefono ?? null,
      logoUrl: createVendedoreDto.logoUrl ?? null,
      redesSociales: this.normalizarRedes(createVendedoreDto.redesSociales),
      passwordHash: await this.passwordService.hash(
        createVendedoreDto.password,
      ),
    });

    const saved = await this.vendedoresRepository.save(created);
    return this.sanitize(saved);
  }

  async login(loginDto: LoginVendedoreDto) {
    const email = String(loginDto.email ?? '')
      .trim()
      .toLowerCase();
    const password = String(loginDto.password ?? '');

    const vendedor = await this.vendedoresRepository.findOne({
      where: { email },
    });

    const verification = await this.passwordService.verify(
      vendedor?.passwordHash ?? VendedoresService.DUMMY_PASSWORD_HASH,
      password,
    );
    if (!vendedor || !verification.valid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }
    if (vendedor.estadoSolicitud !== 'aprobado') {
      throw new UnauthorizedException('Tu cuenta esta pendiente de aprobacion');
    }
    if (
      vendedor.passwordChangeRequired &&
      vendedor.temporaryPasswordExpiresAt &&
      vendedor.temporaryPasswordExpiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('La contraseña temporal venció');
    }
    const usedDefaultPassword = password === '1234';
    const passwordChangeRequired =
      usedDefaultPassword ||
      verification.legacy ||
      vendedor.passwordChangeRequired;

    if (usedDefaultPassword && !vendedor.passwordChangeRequired) {
      vendedor.passwordChangeRequired = true;
      vendedor.temporaryPasswordExpiresAt = null;
      await this.vendedoresRepository.save(vendedor);
    }

    if (vendedor.rol === 'administrador' && this.adminMfaService.isEnabled()) {
      const challenge = await this.adminMfaService.createChallenge(
        vendedor,
        passwordChangeRequired,
      );
      return {
        message: 'Código de acceso enviado',
        mfaRequired: true as const,
        ...challenge,
      };
    }

    return this.createAuthenticatedSession(vendedor, passwordChangeRequired);
  }

  async verifyAdminMfa(challengeId: string, code: string) {
    const vendedor = await this.adminMfaService.verifyChallenge(
      challengeId,
      code,
    );
    return this.createAuthenticatedSession(
      vendedor,
      vendedor.passwordChangeRequired,
    );
  }

  private async createAuthenticatedSession(
    vendedor: Vendedor,
    passwordChangeRequired: boolean,
  ) {
    const user = { ...this.sanitize(vendedor), passwordChangeRequired };
    const accessToken = await this.jwtService.signAsync({
      sub: vendedor.id,
      email: vendedor.email,
      nombre: vendedor.nombre,
      rol: vendedor.rol,
      passwordChangeRequired,
      sessionVersion: vendedor.sessionVersion,
    });

    return {
      message: 'Login exitoso',
      user,
      accessToken,
    };
  }

  async findAll(
    page = 1,
    pageSize = 50,
    includePrivate = false,
    busqueda?: string,
    esMonotributista?: boolean,
  ) {
    const termino = busqueda?.trim();
    const patron = termino ? `%${termino}%` : undefined;
    const filtroMonotributo =
      includePrivate && esMonotributista !== undefined
        ? { esMonotributista }
        : {};
    const where = patron
      ? includePrivate
        ? [
            { ...filtroMonotributo, nombre: ILike(patron) },
            { ...filtroMonotributo, email: ILike(patron) },
            { ...filtroMonotributo, ruess: ILike(patron) },
            { ...filtroMonotributo, descripcionNegocio: ILike(patron) },
            { ...filtroMonotributo, ubicacion: ILike(patron) },
            { ...filtroMonotributo, whatsapp: ILike(patron) },
            { ...filtroMonotributo, telefono: ILike(patron) },
          ]
        : [
            {
              estadoSolicitud: 'aprobado' as const,
              rol: Not<Vendedor['rol']>('administrador'),
              nombre: ILike(patron),
            },
            {
              estadoSolicitud: 'aprobado' as const,
              rol: Not<Vendedor['rol']>('administrador'),
              email: ILike(patron),
            },
          ]
      : includePrivate
        ? esMonotributista === undefined
          ? undefined
          : filtroMonotributo
        : {
            estadoSolicitud: 'aprobado' as const,
            rol: Not<Vendedor['rol']>('administrador'),
          };
    const vendedores = await this.vendedoresRepository.find({
      where,
      order: { id: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return vendedores.map((vendedor) =>
      includePrivate ? this.sanitize(vendedor) : this.sanitizePublic(vendedor),
    );
  }

  async findCatalogo(page = 1, pageSize = 50, busqueda?: string) {
    const termino = busqueda?.trim();
    const patron = termino ? `%${termino}%` : undefined;
    const where = patron
      ? [
          {
            estadoSolicitud: 'aprobado' as const,
            rol: Not<Vendedor['rol']>('administrador'),
            nombre: ILike(patron),
          },
          {
            estadoSolicitud: 'aprobado' as const,
            rol: Not<Vendedor['rol']>('administrador'),
            email: ILike(patron),
          },
          {
            estadoSolicitud: 'aprobado' as const,
            rol: Not<Vendedor['rol']>('administrador'),
            descripcionNegocio: ILike(patron),
          },
        ]
      : {
          estadoSolicitud: 'aprobado' as const,
          rol: Not<Vendedor['rol']>('administrador'),
        };
    const [vendedores, total] = await this.vendedoresRepository.findAndCount({
      where,
      order: { id: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: vendedores.map((vendedor) => this.sanitizePublic(vendedor)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOne(id: number, includePrivate = false) {
    const vendedor = await this.vendedoresRepository.findOne({
      where: includePrivate ? { id } : { id, estadoSolicitud: 'aprobado' },
    });
    if (!vendedor) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return includePrivate
      ? this.sanitize(vendedor)
      : this.sanitizePublic(vendedor);
  }

  async revokeSessions(id: number) {
    const vendedor = await this.vendedoresRepository.findOne({ where: { id } });
    if (!vendedor) {
      throw new NotFoundException('Usuario no encontrado');
    }

    vendedor.sessionVersion = (vendedor.sessionVersion ?? 0) + 1;
    await this.vendedoresRepository.save(vendedor);
  }

  async update(id: number, updateVendedoreDto: UpdateVendedoreDto) {
    const vendedor = await this.vendedoresRepository.findOne({ where: { id } });
    if (!vendedor) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const normalizedEmail = updateVendedoreDto.email?.trim().toLowerCase();
    if (normalizedEmail && normalizedEmail !== vendedor.email) {
      const existingEmail = await this.vendedoresRepository.findOne({
        where: { email: normalizedEmail },
      });
      if (existingEmail) {
        throw new ConflictException('El email ya existe');
      }
    }

    if (updateVendedoreDto.nombre) {
      vendedor.nombre = updateVendedoreDto.nombre;
    }
    if (normalizedEmail) {
      vendedor.email = normalizedEmail;
    }
    if (updateVendedoreDto.ruess !== undefined) {
      vendedor.ruess = updateVendedoreDto.ruess || null;
    }
    if (updateVendedoreDto.esMonotributista !== undefined) {
      vendedor.esMonotributista = updateVendedoreDto.esMonotributista;
    }
    if (updateVendedoreDto.descripcionNegocio !== undefined) {
      vendedor.descripcionNegocio =
        updateVendedoreDto.descripcionNegocio || null;
    }
    if (updateVendedoreDto.integrantesEquipo !== undefined) {
      vendedor.integrantesEquipo = updateVendedoreDto.integrantesEquipo;
    }
    if (updateVendedoreDto.ubicacion !== undefined) {
      vendedor.ubicacion = updateVendedoreDto.ubicacion || null;
    }
    if (updateVendedoreDto.whatsapp !== undefined) {
      vendedor.whatsapp = this.normalizarWhatsapp(updateVendedoreDto.whatsapp);
    }
    if (updateVendedoreDto.telefono !== undefined) {
      vendedor.telefono = updateVendedoreDto.telefono || null;
    }
    if (updateVendedoreDto.logoUrl !== undefined) {
      vendedor.logoUrl = updateVendedoreDto.logoUrl || null;
    }
    if (updateVendedoreDto.redesSociales !== undefined)
      vendedor.redesSociales = this.normalizarRedes(
        updateVendedoreDto.redesSociales,
      );

    const saved = await this.vendedoresRepository.save(vendedor);
    return this.sanitize(saved);
  }

  async updateLogo(id: number, logoUrl: string | null) {
    const vendedor = await this.vendedoresRepository.findOne({ where: { id } });
    if (!vendedor) {
      throw new NotFoundException('Usuario no encontrado');
    }

    vendedor.logoUrl = logoUrl?.trim() ? logoUrl : null;
    const saved = await this.vendedoresRepository.save(vendedor);
    return this.sanitize(saved);
  }

  async changePassword(
    id: number,
    currentPassword: string,
    newPassword: string,
  ) {
    const vendedor = await this.vendedoresRepository.findOne({ where: { id } });
    if (!vendedor) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const currentMatches = await this.passwordService.verify(
      vendedor.passwordHash,
      currentPassword,
    );
    if (!currentMatches.valid) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    if (currentPassword === newPassword) {
      throw new ConflictException(
        'La nueva contraseña debe ser diferente a la actual',
      );
    }

    vendedor.passwordHash = await this.passwordService.hash(newPassword);
    vendedor.sessionVersion = (vendedor.sessionVersion ?? 0) + 1;
    vendedor.passwordChangeRequired = false;
    vendedor.temporaryPasswordExpiresAt = null;
    await this.vendedoresRepository.save(vendedor);

    return { message: 'contraseña actualizada correctamente' };
  }

  async resetPassword(
    id: number,
    temporaryPassword: string,
    adminId: number,
    adminPassword: string,
  ) {
    const admin = await this.vendedoresRepository.findOne({
      where: { id: adminId },
    });
    if (!admin || admin.rol !== 'administrador') {
      throw new ForbiddenException('Solo un administrador puede restablecerla');
    }
    const adminVerification = await this.passwordService.verify(
      admin.passwordHash,
      adminPassword,
    );
    if (!adminVerification.valid) {
      throw new UnauthorizedException(
        'La contraseña actual del administrador es incorrecta',
      );
    }

    const vendedor = await this.vendedoresRepository.findOne({ where: { id } });
    if (!vendedor) {
      throw new NotFoundException('Usuario no encontrado');
    }

    vendedor.passwordHash = await this.passwordService.hash(temporaryPassword);
    vendedor.sessionVersion = (vendedor.sessionVersion ?? 0) + 1;
    vendedor.passwordChangeRequired = true;
    vendedor.temporaryPasswordExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await this.vendedoresRepository.save(vendedor);

    return {
      message:
        'Contraseña restablecida. Vence en 30 minutos y deberá cambiarse al iniciar sesión',
    };
  }

  async makeAdministrator(id: number, adminId: number, adminPassword: string) {
    const admin = await this.vendedoresRepository.findOne({
      where: { id: adminId },
    });
    if (!admin || admin.rol !== 'administrador') {
      throw new ForbiddenException(
        'Solo un administrador puede promover cuentas',
      );
    }
    const adminVerification = await this.passwordService.verify(
      admin.passwordHash,
      adminPassword,
    );
    if (!adminVerification.valid) {
      throw new UnauthorizedException(
        'La contraseña actual del administrador es incorrecta',
      );
    }

    const vendedor = await this.vendedoresRepository.findOne({ where: { id } });
    if (!vendedor) {
      throw new NotFoundException('Usuario no encontrado');
    }

    vendedor.rol = 'administrador';
    vendedor.estadoSolicitud = 'aprobado';
    vendedor.sessionVersion = (vendedor.sessionVersion ?? 0) + 1;

    const saved = await this.vendedoresRepository.save(vendedor);
    return this.sanitize(saved);
  }

  async remove(id: number, requesterId: number) {
    if (id === requesterId) {
      throw new ForbiddenException(
        'No podes eliminar tu propia cuenta administradora',
      );
    }

    const vendedor = await this.vendedoresRepository.findOne({ where: { id } });
    if (!vendedor) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (vendedor.rol === 'administrador') {
      const administratorCount = await this.vendedoresRepository.count({
        where: { rol: 'administrador' },
      });
      if (administratorCount <= 1) {
        throw new ForbiddenException(
          'No se puede eliminar la ultima cuenta administradora',
        );
      }
    }

    await this.vendedoresRepository.remove(vendedor);
    return { deleted: true, id };
  }
}
