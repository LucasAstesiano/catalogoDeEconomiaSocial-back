import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { SolicitudesService } from './solicitudes.service';
import { Public } from '../../auth/public.decorator';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { BadRequestException, ParseIntPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { SolicitudesQueryDto } from './dto/solicitudes-query.dto';

@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Post()
  create(
    @Body() createSolicitudDto: CreateSolicitudDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solicitudesService.create(createSolicitudDto, user);
  }

  @Post('registro')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000, blockDuration: 300_000 } })
  createRegistration(@Body() createSolicitudDto: CreateRegistrationDto) {
    if (createSolicitudDto.tipo !== 'registro_usuario') {
      throw new BadRequestException(
        'Esta ruta solo acepta solicitudes de registro',
      );
    }
    return this.solicitudesService.create(createSolicitudDto);
  }

  @Get()
  @Roles('administrador')
  findAll(@Query() query: SolicitudesQueryDto) {
    return this.solicitudesService.findAll(
      query.estado,
      query.page,
      query.pageSize,
    );
  }

  @Patch(':id/aprobar')
  @Roles('administrador')
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solicitudesService.approve(id, user.sub);
  }

  @Patch(':id/rechazar')
  @Roles('administrador')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solicitudesService.reject(id, user.sub);
  }
}
