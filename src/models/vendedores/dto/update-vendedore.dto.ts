import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateVendedoreDto } from './create-vendedore.dto';

export class UpdateVendedoreDto extends PartialType(
  OmitType(CreateVendedoreDto, ['password', 'rol'] as const),
) {}
