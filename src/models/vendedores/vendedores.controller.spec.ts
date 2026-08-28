import { Test, TestingModule } from '@nestjs/testing';
import { VendedoresController } from './vendedores.controller';
import { VendedoresService } from './vendedores.service';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../auth/roles.decorator';

describe('VendedoresController', () => {
  let controller: VendedoresController;
  const vendedoresService = {
    revokeSessions: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VendedoresController],
      providers: [{ provide: VendedoresService, useValue: vendedoresService }],
    }).compile();

    controller = module.get<VendedoresController>(VendedoresController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('restringe el restablecimiento de contraseña a administradores', () => {
    const reflector = new Reflector();

    // La metadata pertenece al handler sin enlazar que Nest registra.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(reflector.get(ROLES_KEY, controller.resetPassword)).toEqual([
      'administrador',
    ]);
  });

  it.each(['update', 'updateLogo'] as const)(
    'restringe %s a administradores para preservar la moderacion',
    (handler) => {
      const reflector = new Reflector();
      expect(reflector.get(ROLES_KEY, controller[handler])).toEqual([
        'administrador',
      ]);
    },
  );

  it('revoca la sesion antes de borrar la cookie al cerrar sesion', async () => {
    const response = { clearCookie: jest.fn() };
    vendedoresService.revokeSessions.mockResolvedValue(undefined);

    await expect(
      controller.logout(
        {
          sub: 7,
          email: 'usuario@ejemplo.com',
          nombre: 'Usuario',
          rol: 'usuario',
          sessionVersion: 2,
        },
        response as never,
      ),
    ).resolves.toEqual({ message: 'Sesion cerrada' });

    expect(vendedoresService.revokeSessions).toHaveBeenCalledWith(7);
    expect(response.clearCookie).toHaveBeenCalled();
  });
});
