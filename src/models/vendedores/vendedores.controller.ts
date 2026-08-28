import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ForbiddenException,
  ParseIntPipe,
  Res,
  Query,
} from '@nestjs/common';
import type { Response } from 'express';
import { VendedoresService } from './vendedores.service';
import { CreateVendedoreDto } from './dto/create-vendedore.dto';
import { UpdateVendedoreDto } from './dto/update-vendedore.dto';
import { LoginVendedoreDto } from './dto/login-vendedore.dto';
import { ChangePasswordVendedoreDto } from './dto/change-password-vendedore.dto';
import { UpdateLogoVendedoreDto } from './dto/update-logo-vendedore.dto';
import { ResetPasswordVendedoreDto } from './dto/reset-password-vendedore.dto';
import { MakeAdministratorVendedoreDto } from './dto/make-administrator-vendedore.dto';
import { Public } from '../../auth/public.decorator';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import {
  AUTH_COOKIE_NAME,
  type AuthenticatedUser,
} from '../../auth/auth.types';
import { Throttle } from '@nestjs/throttler';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Controller('vendedores')
export class VendedoresController {
  constructor(private readonly vendedoresService: VendedoresService) {}

  /**Crea vendedor pendiente d eaprovación por el admin */
  @Post()
  @Roles('administrador')
  create(@Body() createVendedoreDto: CreateVendedoreDto) {
    return this.vendedoresService.create(createVendedoreDto);
  }

  /**login */
  @Post('login')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000, blockDuration: 300_000 } })
  async login(
    @Body() loginDto: LoginVendedoreDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, ...result } =
      await this.vendedoresService.login(loginDto);
    response.cookie(AUTH_COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 30 * 60 * 1000,
      path: '/',
    });
    return result;
  }

  @Post('logout')
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.vendedoresService.revokeSessions(user.sub);
    response.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
    });
    return { message: 'Sesion cerrada' };
  }

  @Get('session')
  session(@CurrentUser() user: AuthenticatedUser) {
    return {
      user: {
        id: user.sub,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol,
        passwordChangeRequired: user.passwordChangeRequired,
      },
    };
  }

  /**listar vendedores */
  @Get()
  @Public()
  findAll(@Query() query: PaginationQueryDto) {
    return this.vendedoresService.findAll(query.page, query.pageSize);
  }

  @Get('admin/listado')
  @Roles('administrador')
  findAllAdmin(@Query() query: PaginationQueryDto) {
    return this.vendedoresService.findAll(query.page, query.pageSize, true);
  }

  @Get('me/perfil')
  findMyPrivateProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.vendedoresService.findOne(user.sub, true);
  }

  @Patch('me/password')
  changeMyPassword(
    @Body() changePasswordDto: ChangePasswordVendedoreDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vendedoresService.changePassword(
      user.sub,
      String(changePasswordDto.currentPassword ?? ''),
      String(changePasswordDto.newPassword ?? ''),
    );
  }

  @Get(':id/perfil')
  findPrivateProfile(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.assertSelfOrAdmin(id, user);
    return this.vendedoresService.findOne(id, true);
  }

  /**venddor por id */
  @Get(':id')
  @Public()
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.vendedoresService.findOne(id);
  }

  /**actualizar vendedor por id */
  @Patch(':id')
  @Roles('administrador')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateVendedoreDto: UpdateVendedoreDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.assertSelfOrAdmin(id, user);
    return this.vendedoresService.update(id, updateVendedoreDto);
  }

  /**cambiar logo vendedor */
  @Patch(':id/logo')
  @Roles('administrador')
  updateLogo(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLogoDto: UpdateLogoVendedoreDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.assertSelfOrAdmin(id, user);
    return this.vendedoresService.updateLogo(id, updateLogoDto.logoUrl ?? null);
  }

  /**cambiar contraseña */
  @Patch(':id/password')
  changePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() changePasswordDto: ChangePasswordVendedoreDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.assertSelfOrAdmin(id, user);
    return this.vendedoresService.changePassword(
      id,
      String(changePasswordDto.currentPassword ?? ''),
      String(changePasswordDto.newPassword ?? ''),
    );
  }

  /**Restablecer contraseña y forzar su cambio en el próximo inicio de sesión. */
  @Post(':id/password-reset')
  @Roles('administrador')
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() resetPasswordDto: ResetPasswordVendedoreDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.vendedoresService.resetPassword(
      id,
      resetPasswordDto.temporaryPassword,
      admin.sub,
      resetPasswordDto.adminPassword,
    );
  }

  /**hacer administrador */
  @Patch(':id/administrador')
  @Roles('administrador')
  makeAdministrator(
    @Param('id', ParseIntPipe) id: number,
    @Body() makeAdministratorDto: MakeAdministratorVendedoreDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.vendedoresService.makeAdministrator(
      id,
      admin.sub,
      makeAdministratorDto.adminPassword,
    );
  }

  /**Eliminar vendedor */
  @Delete(':id')
  @Roles('administrador')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.vendedoresService.remove(id, admin.sub);
  }

  /** Verifica que el usuario autenticado sea el dueño del ID o administrador. */
  private assertSelfOrAdmin(id: number, user: AuthenticatedUser) {
    if (user.rol !== 'administrador' && user.sub !== id) {
      throw new ForbiddenException('No tenes permisos sobre este usuario');
    }
  }
}
