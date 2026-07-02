import { SolicitudTipo } from '../entities/solicitud.entity';

export class CreateSolicitudDto {
	tipo: SolicitudTipo;
	solicitanteId?: number | null;
	solicitanteEmail?: string | null;
	solicitanteNombre?: string | null;
	entidadObjetivo?: 'vendedor' | 'producto' | 'nuevo_vendedor' | null;
	entidadId?: number | null;
	payload: Record<string, unknown>;
}