import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginVendedoreDto {
  @IsEmail()
  @MaxLength(160)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}
