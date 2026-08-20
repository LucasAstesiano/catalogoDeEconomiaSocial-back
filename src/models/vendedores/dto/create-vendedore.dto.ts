import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateVendedoreDto {
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
  @IsIn(['usuario', 'administrador'])
  rol?: 'usuario' | 'administrador';
  @IsOptional()
  @IsString()
  @MaxLength(30)
  ruess?: string;
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descripcionNegocio?: string;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  integrantesEquipo?: string[];
  @IsOptional()
  @IsString()
  @MaxLength(500)
  ubicacion?: string;
  @IsOptional()
  @IsString()
  @MaxLength(50)
  whatsapp?: string;
  @IsOptional()
  @IsString()
  @MaxLength(50)
  telefono?: string;
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  logoUrl?: string;
}
