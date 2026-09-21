import type { SolicitudTipo } from '../entities/solicitud.entity';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

class RedSocialDto {
  @IsIn(['facebook', 'instagram'])
  tipo: 'facebook' | 'instagram';

  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  url: string;
}

export class SolicitudPayloadDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  productoId?: number;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  categoria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  subcategoria?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  ruess?: string | null;

  @IsOptional()
  @IsBoolean()
  esMonotributista?: boolean | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descripcionNegocio?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  integrantesEquipo?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ubicacion?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\+549\d{10}$/)
  @MaxLength(50)
  whatsapp?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  telefono?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => RedSocialDto)
  redesSociales?: RedSocialDto[];

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  imagenUrl?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  imagenUrl2?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  imagenUrl3?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  imagenUrl4?: string | null;
}

export class CreateSolicitudDto {
  @IsIn([
    'actualizacion_datos',
    'nuevo_producto',
    'actualizacion_producto',
    'eliminacion_producto',
  ])
  tipo: Exclude<SolicitudTipo, 'registro_usuario'>;
  @IsOptional()
  @IsInt()
  @Min(1)
  solicitanteId?: number | null;
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  solicitanteEmail?: string | null;
  @IsOptional()
  @IsString()
  @MaxLength(120)
  solicitanteNombre?: string | null;
  @IsOptional()
  @IsIn(['vendedor', 'producto', 'nuevo_vendedor'])
  entidadObjetivo?: 'vendedor' | 'producto' | 'nuevo_vendedor' | null;
  @IsOptional()
  @IsInt()
  @Min(1)
  entidadId?: number | null;
  @ValidateNested()
  @Type(() => SolicitudPayloadDto)
  payload: SolicitudPayloadDto;
}
