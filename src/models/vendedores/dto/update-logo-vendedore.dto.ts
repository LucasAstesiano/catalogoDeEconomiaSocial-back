import { IsOptional, IsUrl, MaxLength } from 'class-validator';

export class UpdateLogoVendedoreDto {
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  logoUrl: string | null;
}
