import { Transform } from 'class-transformer';
import { IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CategoriaDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre: string;
}

export class CreateCategoriaDto extends CategoriaDto {
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  iconoUrl: string;
}
