import { Test, TestingModule } from '@nestjs/testing';
import { VendedoresService } from './vendedores.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Vendedor } from './entities/vendedore.entity';
import { PasswordService } from '../../auth/password.service';
import { JwtService } from '@nestjs/jwt';

describe('VendedoresService', () => {
  let service: VendedoresService;
  const vendedoresRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
  };
  const passwordService = {
    hash: jest.fn(),
    verify: jest.fn(),
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
        { provide: JwtService, useValue: {} },
      ],
    }).compile();

    service = module.get<VendedoresService>(VendedoresService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
