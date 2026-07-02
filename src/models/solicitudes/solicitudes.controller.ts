import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { SolicitudesService } from './solicitudes.service';

@Controller('solicitudes')
export class SolicitudesController {
	constructor(private readonly solicitudesService: SolicitudesService) {}

	@Post()
	create(@Body() createSolicitudDto: CreateSolicitudDto) {
		return this.solicitudesService.create(createSolicitudDto);
	}

	@Get()
	findAll(@Query('estado') estado?: 'pendiente' | 'aprobada' | 'rechazada') {
		return this.solicitudesService.findAll(estado);
	}

	@Patch(':id/aprobar')
	approve(@Param('id') id: string) {
		return this.solicitudesService.approve(+id);
	}

	@Patch(':id/rechazar')
	reject(@Param('id') id: string) {
		return this.solicitudesService.reject(+id);
	}
}