import { Test, TestingModule } from '@nestjs/testing';
import { VendedoresService } from './vendedores.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Vendedor } from './entities/vendedore.entity';
import { PasswordService } from '../../auth/password.service';
import { JwtService } from '@nestjs/jwt';
import { AdminMfaService } from '../../auth/admin-mfa.service';
import { Not } from 'typeorm';

describe('VendedoresService', () => {
  let service: VendedoresService;
  const vendedoresRepository = {
    find: jest.fn(),
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
  };
  const passwordService = {
    hash: jest.fn(),
    verify: jest.fn(),
  };
  const jwtService = { signAsync: jest.fn() };
  const adminMfaService = {
    isEnabled: jest.fn(),
    createChallenge: jest.fn(),
    verifyChallenge: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendedoresService,
        {
          provide: getRepositoryToken(Vendedor),
          useValue: vendedoresRepository,
        },
        { provide: PasswordService, useValue: passwordService },
        { provide: JwtService, useValue: jwtService },
        { provide: AdminMfaService, useValue: adminMfaService },
      ],
    }).compile();

    service = module.get<VendedoresService>(VendedoresService);
    jest.clearAllMocks();
    adminMfaService.isEnabled.mockReturnValue(false);
    jwtService.signAsync.mockResolvedValue('jwt-firmado');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('publica solamente vendedores aprobados que no sean administradores', async () => {
    vendedoresRepository.find.mockResolvedValue([]);

    await service.findAll(1, 50);

    expect(vendedoresRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { estadoSolicitud: 'aprobado', rol: Not('administrador') },
      }),
    );
  });

  it('pagina la búsqueda pública de emprendedores en el servidor', async () => {
    vendedoresRepository.findAndCount.mockResolvedValue([[], 0]);

    await service.findCatalogo(2, 15, 'deva');

    expect(vendedoresRepository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 15,
        take: 15,
        where: expect.arrayContaining([
          expect.objectContaining({
            estadoSolicitud: 'aprobado',
            rol: Not('administrador'),
          }),
        ]),
      }),
    );
  });

  it('filtra monotributistas solo en el listado administrativo', async () => {
    vendedoresRepository.find.mockResolvedValue([]);

    await service.findAll(1, 50, true, undefined, true);

    expect(vendedoresRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { esMonotributista: true } }),
    );
  });

  it('no permite consultar publicamente un vendedor no aprobado', async () => {
    vendedoresRepository.findOne.mockResolvedValue(null);

    await expect(service.findOne(7)).rejects.toThrow('Usuario no encontrado');
    expect(vendedoresRepository.findOne).toHaveBeenCalledWith({
      where: { id: 7, estadoSolicitud: 'aprobado' },
    });
  });

  it('no expone la condición de monotributo en perfiles públicos', async () => {
    vendedoresRepository.findOne.mockResolvedValue({
      id: 7,
      nombre: 'Emprendimiento',
      email: 'emprendimiento@ejemplo.com',
      estadoSolicitud: 'aprobado',
      esMonotributista: true,
      integrantesEquipo: [],
      redesSociales: [],
    });

    const perfil = await service.findOne(7);

    expect(perfil).not.toHaveProperty('esMonotributista');
  });

  it('revoca la sesion en el servidor al cerrar sesion', async () => {
    const vendedor = { id: 7, sessionVersion: 2 };
    vendedoresRepository.findOne.mockResolvedValue(vendedor);
    vendedoresRepository.save.mockResolvedValue(vendedor);

    await service.revokeSessions(7);

    expect(vendedoresRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ sessionVersion: 3 }),
    );
  });

  it('restablece la contraseña, revoca sesiones y obliga a cambiarla', async () => {
    const admin = {
      id: 1,
      rol: 'administrador',
      passwordHash: 'hash-admin',
    };
    const vendedor = {
      id: 7,
      passwordHash: 'hash-anterior',
      sessionVersion: 2,
      passwordChangeRequired: false,
      temporaryPasswordExpiresAt: null as Date | null,
    };
    vendedoresRepository.findOne
      .mockResolvedValueOnce(admin)
      .mockResolvedValueOnce(vendedor);
    vendedoresRepository.save.mockResolvedValue(vendedor);
    passwordService.hash.mockResolvedValue('hash-temporal-argon2id');
    passwordService.verify.mockResolvedValue({ valid: true, legacy: false });

    await expect(
      service.resetPassword(7, 'Temporal-Segura-2026', 1, 'Password-Admin'),
    ).resolves.toEqual({
      message:
        'Contraseña restablecida. Vence en 30 minutos y deberá cambiarse al iniciar sesión',
    });
    expect(passwordService.verify).toHaveBeenCalledWith(
      'hash-admin',
      'Password-Admin',
    );
    expect(passwordService.hash).toHaveBeenCalledWith('Temporal-Segura-2026');
    expect(vendedoresRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordHash: 'hash-temporal-argon2id',
        sessionVersion: 3,
        passwordChangeRequired: true,
      }),
    );
    expect(vendedor.temporaryPasswordExpiresAt).toBeInstanceOf(Date);
  });

  it('rechaza el restablecimiento si la contraseña del admin es incorrecta', async () => {
    vendedoresRepository.findOne.mockResolvedValue({
      id: 1,
      rol: 'administrador',
      passwordHash: 'hash-admin',
    });
    passwordService.verify.mockResolvedValue({ valid: false, legacy: false });

    await expect(
      service.resetPassword(7, 'Temporal-Segura-2026', 1, 'incorrecta'),
    ).rejects.toThrow('La contraseña actual del administrador es incorrecta');
    expect(vendedoresRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza una contraseña temporal vencida durante el login', async () => {
    vendedoresRepository.findOne.mockResolvedValue({
      id: 7,
      email: 'usuario@ejemplo.com',
      estadoSolicitud: 'aprobado',
      passwordHash: 'hash-temporal',
      passwordChangeRequired: true,
      temporaryPasswordExpiresAt: new Date(Date.now() - 1_000),
    });
    passwordService.verify.mockResolvedValue({ valid: true, legacy: false });

    await expect(
      service.login({
        email: 'usuario@ejemplo.com',
        password: 'Temporal-Segura-2026',
      }),
    ).rejects.toThrow('La contraseña temporal venció');
  });

  it('obliga a cambiar la contraseña predeterminada 1234', async () => {
    const vendedor = {
      id: 7,
      email: 'usuario@ejemplo.com',
      nombre: 'Usuario',
      rol: 'usuario',
      estadoSolicitud: 'aprobado',
      passwordHash: 'hash-real',
      passwordChangeRequired: false,
      temporaryPasswordExpiresAt: null,
      sessionVersion: 0,
    };
    vendedoresRepository.findOne.mockResolvedValue(vendedor);
    vendedoresRepository.save.mockResolvedValue(vendedor);
    passwordService.verify.mockResolvedValue({ valid: true, legacy: false });

    const result = await service.login({
      email: 'usuario@ejemplo.com',
      password: '1234',
    });

    expect(vendedoresRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ passwordChangeRequired: true }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        // Jest declara objectContaining como any; el matcher no transporta datos de dominio.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        user: expect.objectContaining({ passwordChangeRequired: true }),
      }),
    );
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ passwordChangeRequired: true }),
    );
  });

  it('verifica un hash dummy cuando el email no existe', async () => {
    vendedoresRepository.findOne.mockResolvedValue(null);
    passwordService.verify.mockResolvedValue({ valid: false, legacy: false });

    await expect(
      service.login({
        email: 'inexistente@ejemplo.com',
        password: 'Password-Incorrecta-2026',
      }),
    ).rejects.toThrow('Credenciales incorrectas');

    expect(passwordService.verify).toHaveBeenCalledWith(
      expect.stringMatching(/^\$argon2id\$/),
      'Password-Incorrecta-2026',
    );
  });

  it('no revela el estado de una cuenta si la contraseña es incorrecta', async () => {
    vendedoresRepository.findOne.mockResolvedValue({
      id: 7,
      email: 'pendiente@ejemplo.com',
      estadoSolicitud: 'pendiente',
      passwordHash: 'hash-real',
    });
    passwordService.verify.mockResolvedValue({ valid: false, legacy: false });

    await expect(
      service.login({
        email: 'pendiente@ejemplo.com',
        password: 'Password-Incorrecta-2026',
      }),
    ).rejects.toThrow('Credenciales incorrectas');
  });

  it('informa el estado pendiente solamente después de validar la contraseña', async () => {
    vendedoresRepository.findOne.mockResolvedValue({
      id: 7,
      email: 'pendiente@ejemplo.com',
      estadoSolicitud: 'pendiente',
      passwordHash: 'hash-real',
    });
    passwordService.verify.mockResolvedValue({ valid: true, legacy: false });

    await expect(
      service.login({
        email: 'pendiente@ejemplo.com',
        password: 'Password-Correcta-2026',
      }),
    ).rejects.toThrow('Tu cuenta esta pendiente de aprobacion');
  });

  it('no emite una sesión administradora antes de validar el código', async () => {
    const admin = {
      id: 1,
      nombre: 'Admin',
      email: 'admin@institucion.gob.ar',
      rol: 'administrador',
      estadoSolicitud: 'aprobado',
      passwordHash: 'hash-real',
      passwordChangeRequired: false,
      temporaryPasswordExpiresAt: null,
    };
    vendedoresRepository.findOne.mockResolvedValue(admin);
    passwordService.verify.mockResolvedValue({ valid: true, legacy: false });
    adminMfaService.isEnabled.mockReturnValue(true);
    adminMfaService.createChallenge.mockResolvedValue({
      challengeId: 'c336f849-f5c4-4f9d-8f25-fc01629f1a01',
      emailMasked: 'ad***@institucion.gob.ar',
      expiresInSeconds: 300,
    });

    await expect(
      service.login({
        email: admin.email,
        password: 'Password-Correcta-2026',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        mfaRequired: true,
        challengeId: 'c336f849-f5c4-4f9d-8f25-fc01629f1a01',
      }),
    );
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('emite la sesión administradora después de consumir el desafío', async () => {
    const admin = {
      id: 1,
      nombre: 'Admin',
      email: 'admin@institucion.gob.ar',
      rol: 'administrador',
      estadoSolicitud: 'aprobado',
      passwordChangeRequired: false,
      sessionVersion: 3,
    };
    adminMfaService.verifyChallenge.mockResolvedValue(admin);

    await expect(
      service.verifyAdminMfa('c336f849-f5c4-4f9d-8f25-fc01629f1a01', '123456'),
    ).resolves.toEqual(expect.objectContaining({ accessToken: 'jwt-firmado' }));
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 1, rol: 'administrador' }),
    );
  });

  it('impide que un administrador elimine su propia cuenta', async () => {
    await expect(service.remove(1, 1)).rejects.toThrow(
      'No podes eliminar tu propia cuenta administradora',
    );

    expect(vendedoresRepository.findOne).not.toHaveBeenCalled();
    expect(vendedoresRepository.remove).not.toHaveBeenCalled();
  });

  it('impide eliminar la ultima cuenta administradora', async () => {
    vendedoresRepository.findOne.mockResolvedValue({
      id: 2,
      rol: 'administrador',
    });
    vendedoresRepository.count.mockResolvedValue(1);

    await expect(service.remove(2, 1)).rejects.toThrow(
      'No se puede eliminar la ultima cuenta administradora',
    );

    expect(vendedoresRepository.remove).not.toHaveBeenCalled();
  });

  it('permite eliminar otro administrador cuando quedan cuentas administradoras', async () => {
    const administrador = { id: 2, rol: 'administrador' };
    vendedoresRepository.findOne.mockResolvedValue(administrador);
    vendedoresRepository.count.mockResolvedValue(2);
    vendedoresRepository.remove.mockResolvedValue(administrador);

    await expect(service.remove(2, 1)).resolves.toEqual({
      deleted: true,
      id: 2,
    });
    expect(vendedoresRepository.remove).toHaveBeenCalledWith(administrador);
  });

  it('exige la contraseña actual para promover una cuenta a administrador', async () => {
    vendedoresRepository.findOne.mockResolvedValue({
      id: 1,
      rol: 'administrador',
      passwordHash: 'hash-admin',
    });
    passwordService.verify.mockResolvedValue({ valid: false, legacy: false });

    await expect(
      service.makeAdministrator(7, 1, 'Password-Incorrecta'),
    ).rejects.toThrow('La contraseña actual del administrador es incorrecta');

    expect(vendedoresRepository.findOne).toHaveBeenCalledTimes(1);
    expect(vendedoresRepository.save).not.toHaveBeenCalled();
  });

  it('promueve una cuenta después de reautenticar al administrador', async () => {
    const admin = {
      id: 1,
      rol: 'administrador',
      passwordHash: 'hash-admin',
    };
    const vendedor = {
      id: 7,
      rol: 'usuario',
      estadoSolicitud: 'pendiente',
      sessionVersion: 2,
    };
    vendedoresRepository.findOne
      .mockResolvedValueOnce(admin)
      .mockResolvedValueOnce(vendedor);
    passwordService.verify.mockResolvedValue({ valid: true, legacy: false });
    vendedoresRepository.save.mockResolvedValue(vendedor);

    await expect(
      service.makeAdministrator(7, 1, 'Password-Admin-Correcta'),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 7,
        rol: 'administrador',
        estadoSolicitud: 'aprobado',
      }),
    );
    expect(passwordService.verify).toHaveBeenCalledWith(
      'hash-admin',
      'Password-Admin-Correcta',
    );
    expect(vendedoresRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        rol: 'administrador',
        estadoSolicitud: 'aprobado',
        sessionVersion: 3,
      }),
    );
  });
});
