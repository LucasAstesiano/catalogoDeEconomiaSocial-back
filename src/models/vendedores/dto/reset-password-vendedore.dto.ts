import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordVendedoreDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  adminPassword: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  temporaryPassword: string;
}
