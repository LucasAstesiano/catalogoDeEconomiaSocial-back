import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { JwtService } from '@nestjs/jwt';
import type { Repository } from 'typeorm';
import { Vendedor } from '../models/vendedores/entities/vendedore.entity';
import { AuthGuard } from './auth.guard';

describe('AuthGuard revocacion de sesiones', () => {
  const jwtService = { verifyAsync: jest.fn() };
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
  const vendedoresRepository = { findOne: jest.fn() };
  const request = {
    headers: { cookie: '__Host-catalogo_session=token' },
    method: 'GET',
    originalUrl: '/api/v1/vendedores/session',
    path: '/vendedores/session',
    ip: '172.20.0.2',
  };
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const guard = new AuthGuard(
    jwtService as unknown as JwtService,
    reflector as unknown as Reflector,
    vendedoresRepository as unknown as Repository<Vendedor>,
  );

  beforeEach(() => jest.clearAllMocks());

  afterEach(() => {
    request.method = 'GET';
    request.originalUrl = '/api/v1/vendedores/session';
    request.path = '/vendedores/session';
  });

  it('rechaza un token cuya version fue revocada', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 4, sessionVersion: 2 });
    vendedoresRepository.findOne.mockResolvedValue({
      id: 4,
      sessionVersion: 3,
      estadoSolicitud: 'aprobado',
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rechaza claims sin sub valido antes de consultar la base', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sessionVersion: 0 });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(vendedoresRepository.findOne).not.toHaveBeenCalled();
  });

  it('usa el rol actual almacenado y no el rol antiguo del token', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 4,
      email: 'anterior@ejemplo.com',
      nombre: 'Anterior',
      rol: 'administrador',
      sessionVersion: 3,
    });
    vendedoresRepository.findOne.mockResolvedValue({
      id: 4,
      email: 'actual@ejemplo.com',
      nombre: 'Actual',
      rol: 'usuario',
      sessionVersion: 3,
      estadoSolicitud: 'aprobado',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toHaveProperty('user.rol', 'usuario');
  });

  it('permite cambiar la contraseña legacy usando la ruta con prefijo global', async () => {
    request.method = 'PATCH';
    request.originalUrl = '/api/v1/vendedores/4/password';
    request.path = '/api/v1/vendedores/4/password';
    jwtService.verifyAsync.mockResolvedValue({
      sub: 4,
      sessionVersion: 3,
      passwordChangeRequired: true,
    });
    vendedoresRepository.findOne.mockResolvedValue({
      id: 4,
      email: 'legacy@ejemplo.com',
      nombre: 'Legacy',
      rol: 'usuario',
      sessionVersion: 3,
      estadoSolicitud: 'aprobado',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('permite consultar la sesión para mostrar el cambio obligatorio', async () => {
    request.originalUrl = '/api/v1/vendedores/session';
    request.path = '/api/v1/vendedores/session';
    jwtService.verifyAsync.mockResolvedValue({
      sub: 4,
      sessionVersion: 3,
      passwordChangeRequired: true,
    });
    vendedoresRepository.findOne.mockResolvedValue({
      id: 4,
      email: 'legacy@ejemplo.com',
      nombre: 'Legacy',
      rol: 'usuario',
      sessionVersion: 3,
      estadoSolicitud: 'aprobado',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('permite cerrar y revocar una sesión con cambio obligatorio', async () => {
    request.method = 'POST';
    request.originalUrl = '/api/v1/vendedores/logout';
    request.path = '/api/v1/vendedores/logout';
    jwtService.verifyAsync.mockResolvedValue({
      sub: 4,
      sessionVersion: 3,
      passwordChangeRequired: true,
    });
    vendedoresRepository.findOne.mockResolvedValue({
      id: 4,
      email: 'legacy@ejemplo.com',
      nombre: 'Legacy',
      rol: 'usuario',
      sessionVersion: 3,
      estadoSolicitud: 'aprobado',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('conserva el error especifico cuando el usuario legacy accede a otra ruta', async () => {
    request.originalUrl = '/api/v1/productos';
    request.path = '/api/v1/productos';
    jwtService.verifyAsync.mockResolvedValue({
      sub: 4,
      sessionVersion: 3,
      passwordChangeRequired: true,
    });
    vendedoresRepository.findOne.mockResolvedValue({
      id: 4,
      email: 'legacy@ejemplo.com',
      nombre: 'Legacy',
      rol: 'usuario',
      sessionVersion: 3,
      estadoSolicitud: 'aprobado',
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      constructor: ForbiddenException,
      message: 'Debes cambiar tu contraseña antes de continuar',
    });
  });
});
