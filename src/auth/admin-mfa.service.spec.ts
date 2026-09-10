import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { AdminMfaService } from './admin-mfa.service';
import { Vendedor } from '../models/vendedores/entities/vendedore.entity';

describe('AdminMfaService', () => {
  const repository = {
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const configValues: Record<string, string> = {
    ADMIN_EMAIL_MFA_ENABLED: 'true',
    MFA_SECRET: 'm'.repeat(64),
    SMTP_HOST: 'correo.institucion.gob.ar',
    SMTP_PORT: '587',
    SMTP_REQUIRE_TLS: 'true',
    SMTP_FROM: 'no-responder@institucion.gob.ar',
  };
  let service: AdminMfaService;
  let sendMail: jest.Mock;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminMfaService,
        { provide: getRepositoryToken(Vendedor), useValue: repository },
        {
          provide: ConfigService,
          useValue: { get: (name: string) => configValues[name] },
        },
      ],
    }).compile();

    service = module.get(AdminMfaService);
    sendMail = jest.fn().mockResolvedValue({ messageId: 'mensaje-1' });
    (
      service as unknown as { transporter: { sendMail: jest.Mock } }
    ).transporter.sendMail = sendMail;
    jest.clearAllMocks();
    sendMail.mockResolvedValue({ messageId: 'mensaje-1' });
    repository.save.mockImplementation((value: unknown) =>
      Promise.resolve(value),
    );
  });

  it('guarda solamente el hash y envia un codigo de seis digitos', async () => {
    const vendedor = {
      id: 1,
      email: 'administrador@institucion.gob.ar',
      adminMfaChallengeId: null,
      adminMfaCodeHash: null,
      adminMfaExpiresAt: null,
      adminMfaAttempts: 0,
      passwordChangeRequired: false,
    } as Vendedor;

    const result = await service.createChallenge(vendedor, false);
    const message = (
      sendMail.mock.calls as unknown as Array<[{ text: string }]>
    )[0][0];
    const code = message.text.match(/\b\d{6}\b/)?.[0];

    expect(code).toMatch(/^\d{6}$/);
    expect(vendedor.adminMfaCodeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(vendedor.adminMfaCodeHash).not.toBe(code);
    expect(vendedor.adminMfaExpiresAt).toBeInstanceOf(Date);
    expect(result.emailMasked).toBe('ad***********@institucion.gob.ar');
  });

  it('consume el desafio de forma atomica antes de emitir la sesion', async () => {
    const builder = createUpdateBuilder({ affected: 1, raw: [{ id: 1 }] });
    repository.createQueryBuilder.mockReturnValue(builder);
    repository.findOne.mockResolvedValue({
      id: 1,
      rol: 'administrador',
      estadoSolicitud: 'aprobado',
    });

    await expect(
      service.verifyChallenge('c336f849-f5c4-4f9d-8f25-fc01629f1a01', '123456'),
    ).resolves.toEqual(expect.objectContaining({ id: 1 }));
    expect(builder.set).toHaveBeenCalledWith(
      expect.objectContaining({ adminMfaChallengeId: null }),
    );
  });

  it('incrementa los intentos ante un codigo incorrecto', async () => {
    const consumeBuilder = createUpdateBuilder({ affected: 0, raw: [] });
    const attemptBuilder = createUpdateBuilder({ affected: 1, raw: [] });
    repository.createQueryBuilder
      .mockReturnValueOnce(consumeBuilder)
      .mockReturnValueOnce(attemptBuilder);

    await expect(
      service.verifyChallenge('c336f849-f5c4-4f9d-8f25-fc01629f1a01', '000000'),
    ).rejects.toThrow('Código inválido o vencido');
    expect(attemptBuilder.set).toHaveBeenCalled();
    const attemptUpdate = (
      attemptBuilder.set.mock.calls as unknown as Array<
        [{ adminMfaAttempts: unknown }]
      >
    )[0][0];
    expect(typeof attemptUpdate.adminMfaAttempts).toBe('function');
  });
});

function createUpdateBuilder(result: { affected: number; raw: unknown[] }) {
  const builder = {
    update: jest.fn(),
    set: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    returning: jest.fn(),
    execute: jest.fn().mockResolvedValue(result),
  };
  builder.update.mockReturnValue(builder);
  builder.set.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.andWhere.mockReturnValue(builder);
  builder.returning.mockReturnValue(builder);
  return builder;
}
