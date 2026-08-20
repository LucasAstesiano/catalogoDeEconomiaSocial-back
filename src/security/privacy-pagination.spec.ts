import type { JwtService } from '@nestjs/jwt';
import type { Repository } from 'typeorm';
import type { PasswordService } from '../auth/password.service';
import { Vendedor } from '../models/vendedores/entities/vendedore.entity';
import { VendedoresService } from '../models/vendedores/vendedores.service';

describe('privacidad y paginacion', () => {
  it('limita la consulta, publica contactos autorizados y omite datos internos', async () => {
    const vendedoresRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 1,
          nombre: 'Emprendimiento',
          email: 'privado@ejemplo.com',
          whatsapp: '2610000000',
          telefono: '2611111111',
          rol: 'usuario',
          estadoSolicitud: 'aprobado',
          integrantesEquipo: [],
        },
      ]),
    };
    const service = new VendedoresService(
      vendedoresRepository as unknown as Repository<Vendedor>,
      {} as PasswordService,
      {} as JwtService,
    );

    const result = await service.findAll(2, 25);

    expect(vendedoresRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 25, take: 25 }),
    );
    expect(result[0]).toEqual(
      expect.objectContaining({
        email: 'privado@ejemplo.com',
        whatsapp: '2610000000',
        telefono: '2611111111',
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(
      /passwordHash|sessionVersion|estadoSolicitud|"rol"/i,
    );
  });
});
