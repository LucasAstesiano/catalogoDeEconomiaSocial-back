import { NotFoundException } from '@nestjs/common';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { PasswordService } from '../../auth/password.service';
import { Producto } from '../productos/entities/producto.entity';
import { Vendedor } from '../vendedores/entities/vendedore.entity';
import { Solicitud } from './entities/solicitud.entity';
import { SolicitudesService } from './solicitudes.service';

describe('SolicitudesService.reject', () => {
  const solicitudes = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const getRepository = jest.fn(() => solicitudes);
  const manager = {
    getRepository,
  } as unknown as EntityManager;
  const dataSource = {
    transaction: jest.fn(
      async (callback: (entityManager: EntityManager) => Promise<unknown>) =>
        callback(manager),
    ),
  } as unknown as DataSource;
  const service = new SolicitudesService(
    {} as Repository<Solicitud>,
    {} as Repository<Vendedor>,
    {} as Repository<Producto>,
    {} as PasswordService,
    dataSource,
  );

  beforeEach(() => jest.clearAllMocks());

  it('rechaza la solicitud sin eliminar usuarios', async () => {
    const solicitud = {
      id: 7,
      tipo: 'registro_usuario',
      estado: 'pendiente',
      solicitanteEmail: 'Persona@Ejemplo.com',
      payload: { email: 'Persona@Ejemplo.com', passwordHash: 'hash' },
    } as Solicitud;
    solicitudes.findOne.mockResolvedValue(solicitud);
    solicitudes.save.mockImplementation((value: Solicitud) =>
      Promise.resolve(value),
    );

    const result = await service.reject(7, 1);

    expect(getRepository).toHaveBeenCalledTimes(1);
    expect(getRepository).toHaveBeenCalledWith(Solicitud);
    expect(result.estado).toBe('rechazada');
    expect(result.resueltoPor).toBe(1);
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(JSON.stringify(result)).not.toContain('hash');
  });

  it('no elimina usuarios ni modifica solicitudes ya resueltas', async () => {
    const solicitud = {
      id: 8,
      tipo: 'registro_usuario',
      estado: 'aprobada',
      payload: { email: 'aprobado@ejemplo.com', passwordHash: 'hash' },
    } as Solicitud;
    solicitudes.findOne.mockResolvedValue(solicitud);

    const result = await service.reject(8, 1);

    expect(result).toEqual({
      ...solicitud,
      payload: { email: 'aprobado@ejemplo.com' },
    });
    expect(solicitudes.save).not.toHaveBeenCalled();
  });

  it('informa cuando la solicitud no existe', async () => {
    solicitudes.findOne.mockResolvedValue(null);
    await expect(service.reject(999, 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('SolicitudesService respuestas seguras', () => {
  const solicitudesRepository = {
    create: jest.fn((value: Solicitud) => value),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const vendedoresRepository = { findOne: jest.fn() };
  const passwordService = { hash: jest.fn() };
  const service = new SolicitudesService(
    solicitudesRepository as unknown as Repository<Solicitud>,
    vendedoresRepository as unknown as Repository<Vendedor>,
    {} as Repository<Producto>,
    passwordService as unknown as PasswordService,
    {} as DataSource,
  );

  beforeEach(() => jest.clearAllMocks());

  it('devuelve un DTO minimo y nunca expone secretos al registrar', async () => {
    vendedoresRepository.findOne.mockResolvedValue(null);
    solicitudesRepository.findOne.mockResolvedValue(null);
    passwordService.hash.mockResolvedValue('argon2-secret-hash');
    solicitudesRepository.save.mockImplementation((value: Solicitud) =>
      Promise.resolve({
        ...value,
        id: 10,
        createdAt: new Date('2026-08-19T12:00:00Z'),
      }),
    );

    const result = await service.create({
      tipo: 'registro_usuario',
      entidadObjetivo: 'nuevo_vendedor',
      payload: {
        nombre: 'Persona',
        email: 'persona@ejemplo.com',
        password: 'secreto-muy-largo',
      },
    });

    expect(result).toEqual({
      id: 10,
      tipo: 'registro_usuario',
      estado: 'pendiente',
      createdAt: new Date('2026-08-19T12:00:00Z'),
    });
    expect(JSON.stringify(result)).not.toMatch(/password|secret|hash/i);
    expect(solicitudesRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest construye este matcher dinamicamente y su tipo publico es `any`.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        payload: expect.objectContaining({
          passwordHash: 'argon2-secret-hash',
        }),
      }),
    );
  });

  it('elimina secretos del listado administrativo sin mutar la entidad', async () => {
    const stored = {
      id: 11,
      payload: {
        email: 'persona@ejemplo.com',
        password: 'legacy-secret',
        passwordHash: 'argon2-secret-hash',
      },
    } as Solicitud;
    solicitudesRepository.find.mockResolvedValue([stored]);

    const result = await service.findAll();

    expect(result[0].payload).toEqual({ email: 'persona@ejemplo.com' });
    expect(JSON.stringify(result)).not.toMatch(/password|secret|hash/i);
    expect(stored.payload).toHaveProperty('passwordHash');
  });
});
