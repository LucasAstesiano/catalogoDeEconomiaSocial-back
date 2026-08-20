import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProductoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre: string;
  @IsString()
  @MinLength(2)
  @MaxLength(10000)
  descripcion: string;
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  categoria: string;
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subcategoria?: string;
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(2000)
  imagenUrl?: string;
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(2000)
  imagenUrl2?: string;
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(2000)
  imagenUrl3?: string;
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(2000)
  imagenUrl4?: string;
  @IsInt()
  @Min(1)
  vendedorId: number;
  @IsOptional()
  @IsBoolean()
  destacado?: boolean;
}
