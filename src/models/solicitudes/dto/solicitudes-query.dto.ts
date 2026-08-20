import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import type { SolicitudEstado } from '../entities/solicitud.entity';

export class SolicitudesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['pendiente', 'aprobada', 'rechazada'])
  estado?: SolicitudEstado;
}
