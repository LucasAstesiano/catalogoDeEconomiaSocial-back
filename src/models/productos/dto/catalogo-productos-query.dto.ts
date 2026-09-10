import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const trimQueryValue = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CatalogoProductosQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(trimQueryValue)
  @IsString()
  @MaxLength(120)
  busqueda?: string;

  @IsOptional()
  @Transform(trimQueryValue)
  @IsString()
  @MaxLength(80)
  categoria?: string;

  @IsOptional()
  @Transform(trimQueryValue)
  @IsString()
  @MaxLength(120)
  subcategoria?: string;
}
