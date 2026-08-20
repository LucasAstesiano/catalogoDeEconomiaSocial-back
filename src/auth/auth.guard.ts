import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendedor } from '../models/vendedores/entities/vendedore.entity';
import { IS_PUBLIC_KEY } from './public.decorator';
import {
  AUTH_COOKIE_NAME,
  AuthenticatedRequest,
  AuthenticatedUser,
} from './auth.types';

function getCookie(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger('Auth');
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    @InjectRepository(Vendedor)
    private readonly vendedoresRepository: Repository<Vendedor>,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = getCookie(request.headers.cookie, AUTH_COOKIE_NAME);
    if (!token) {
      this.logger.warn(
        `Acceso sin token method=${request.method} path=${request.originalUrl} ip=${request.ip}`,
      );
      throw new UnauthorizedException('Autenticacion requerida');
    }

    try {
      const claims =
        await this.jwtService.verifyAsync<AuthenticatedUser>(token);
      const vendedor = await this.vendedoresRepository.findOne({
        where: { id: claims.sub },
      });
      if (
        !vendedor ||
        vendedor.estadoSolicitud !== 'aprobado' ||
        claims.sessionVersion !== vendedor.sessionVersion
      ) {
        throw new UnauthorizedException('Sesion revocada');
      }
      request.user = {
        ...claims,
        email: vendedor.email,
        nombre: vendedor.nombre,
        rol: vendedor.rol,
      };
      if (
        request.user.passwordChangeRequired &&
        !/^\/vendedores\/\d+\/password$/.test(request.path)
      ) {
        throw new UnauthorizedException(
          'Debes cambiar tu contraseña antes de continuar',
        );
      }
      return true;
    } catch {
      this.logger.warn(
        `Token rechazado method=${request.method} path=${request.originalUrl} ip=${request.ip}`,
      );
      throw new UnauthorizedException('Token invalido o vencido');
    }
  }
}
