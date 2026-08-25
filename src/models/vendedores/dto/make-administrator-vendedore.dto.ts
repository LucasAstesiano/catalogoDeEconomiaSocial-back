import { IsString, MaxLength, MinLength } from 'class-validator';

export class MakeAdministratorVendedoreDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  adminPassword: string;
}
