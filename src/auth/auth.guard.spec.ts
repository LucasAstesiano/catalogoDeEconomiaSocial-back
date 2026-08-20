import { UnauthorizedException } from '@nestjs/common';
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
    headers: { cookie: 'catalogo_session=token' },
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
});
