import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  Matches,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class RedSocialDto {
  @IsIn(['facebook', 'instagram'])
  tipo: 'facebook' | 'instagram';

  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  url: string;
}

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
  @IsString()
  @MaxLength(30)
  ruess?: string;
  @IsOptional()
  @IsBoolean()
  esMonotributista?: boolean | null;
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
  @Matches(/^\+549\d{10}$/)
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
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => RedSocialDto)
  redesSociales?: RedSocialDto[];
}
