import { Test, TestingModule } from '@nestjs/testing';
import { VendedoresService } from './vendedores.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Vendedor } from './entities/vendedore.entity';
import { PasswordService } from '../../auth/password.service';
import { JwtService } from '@nestjs/jwt';

describe('VendedoresService', () => {
  let service: VendedoresService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendedoresService,
        { provide: getRepositoryToken(Vendedor), useValue: {} },
        { provide: PasswordService, useValue: {} },
        { provide: JwtService, useValue: {} },
      ],
    }).compile();

    service = module.get<VendedoresService>(VendedoresService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
