import { Test, TestingModule } from '@nestjs/testing';
import { ProductosService } from './productos.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Producto } from './entities/producto.entity';
import { Vendedor } from '../vendedores/entities/vendedore.entity';
import { Categoria } from '../categorias/entities/categoria.entity';

describe('ProductosService', () => {
  let service: ProductosService;
  let productosRepository: {
    createQueryBuilder: jest.Mock;
    find: jest.Mock;
  };
  let vendedoresRepository: { find: jest.Mock };
  let categoriasRepository: { findOne: jest.Mock };

  beforeEach(async () => {
    productosRepository = {
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
    };
    vendedoresRepository = { find: jest.fn() };
    categoriasRepository = { findOne: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductosService,
        {
          provide: getRepositoryToken(Producto),
          useValue: productosRepository,
        },
        {
          provide: getRepositoryToken(Vendedor),
          useValue: vendedoresRepository,
        },
        {
          provide: getRepositoryToken(Categoria),
          useValue: categoriasRepository,
        },
      ],
    }).compile();

    service = module.get<ProductosService>(ProductosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('pagina los productos en la base y devuelve el total real', async () => {
    const builder = {
      orderBy: jest.fn(),
      skip: jest.fn(),
      take: jest.fn(),
      andWhere: jest.fn(),
      getManyAndCount: jest.fn(),
    };
    Object.values(builder).forEach((method) => method.mockReturnValue(builder));
    builder.getManyAndCount.mockResolvedValue([
      [{ id: 940, vendedorId: 8, nombre: 'Producto' }],
      940,
    ]);
    productosRepository.createQueryBuilder.mockReturnValue(builder);
    vendedoresRepository.find.mockResolvedValue([
      { id: 8, nombre: 'Emprendimiento' },
    ]);

    const result = await service.findCatalog({
      page: 2,
      pageSize: 15,
      busqueda: 'tejido',
    });

    expect(builder.skip).toHaveBeenCalledWith(15);
    expect(builder.take).toHaveBeenCalledWith(15);
    expect(builder.andWhere).toHaveBeenCalledWith(
      '(producto.nombre ILIKE :busqueda OR producto.descripcion ILIKE :busqueda)',
      { busqueda: '%tejido%' },
    );
    expect(result).toMatchObject({
      total: 940,
      page: 2,
      pageSize: 15,
      totalPages: 63,
      items: [{ id: 940, vendedorNombre: 'Emprendimiento' }],
    });
  });

  it('consulta solamente la cantidad solicitada de destacados', async () => {
    productosRepository.find.mockResolvedValue([
      { id: 900, vendedorId: 8, destacado: true },
    ]);
    vendedoresRepository.find.mockResolvedValue([
      { id: 8, nombre: 'Emprendimiento' },
    ]);

    const result = await service.findFeatured(6);

    expect(productosRepository.find).toHaveBeenCalledWith({
      where: { destacado: true },
      order: { id: 'DESC' },
      take: 6,
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: 900,
        vendedorNombre: 'Emprendimiento',
      }),
    ]);
  });
});
