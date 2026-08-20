export type AuthenticatedUser = {
  sub: number;
  email: string;
  nombre: string;
  rol: 'usuario' | 'administrador';
  sessionVersion: number;
  passwordChangeRequired?: boolean;
};

export type AuthenticatedRequest = Request & { user: AuthenticatedUser };

export const AUTH_COOKIE_NAME = 'catalogo_session';
import type { Request } from 'express';
