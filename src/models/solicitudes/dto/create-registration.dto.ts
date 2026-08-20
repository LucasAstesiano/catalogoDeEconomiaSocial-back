import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RegistrationPayloadDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre: string;

  @IsEmail()
  @MaxLength(160)
  email: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  ruess?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descripcionNegocio?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  integrantesEquipo?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ubicacion?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  whatsapp?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  telefono?: string | null;
}

export class CreateRegistrationDto {
  @IsIn(['registro_usuario'])
  tipo: 'registro_usuario';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  solicitanteNombre?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  solicitanteEmail?: string | null;

  @IsIn(['nuevo_vendedor'])
  entidadObjetivo: 'nuevo_vendedor';

  @ValidateNested()
  @Type(() => RegistrationPayloadDto)
  payload: RegistrationPayloadDto;
}
