import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PasswordService } from './password.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vendedor } from '../models/vendedores/entities/vendedore.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Vendedor]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret || secret.length < 32) {
          throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
        }
        return {
          secret,
          signOptions: { expiresIn: '30m', issuer: 'catalogo-economia-social' },
          verifyOptions: { issuer: 'catalogo-economia-social' },
        };
      },
    }),
  ],
  providers: [PasswordService],
  exports: [JwtModule, PasswordService, TypeOrmModule],
})
export class AuthModule {}
