import { IsString, IsUUID, Matches } from 'class-validator';

export class VerifyAdminMfaDto {
  @IsUUID('4')
  challengeId: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'El código debe contener 6 dígitos' })
  code: string;
}
