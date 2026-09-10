import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { Producto } from './entities/producto.entity';
import { Vendedor } from '../vendedores/entities/vendedore.entity';
import { assertAllowedImageUrls } from '../../security/image-url';
import { CatalogoProductosQueryDto } from './dto/catalogo-productos-query.dto';

const normalizarBooleano = (valor: unknown): boolean => {
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return valor === 1;
  if (typeof valor === 'string') {
    const normalizado = valor.trim().toLowerCase();
    if (['true', '1', 'si', 'sí', 'yes', 'on'].includes(normalizado))
      return true;
    if (['false', '0', 'no', 'off', ''].includes(normalizado)) return false;
  }
  return false;
};

@Injectable()
export class ProductosService {
  constructor(
    @InjectRepository(Producto)
    private readonly productosRepository: Repository<Producto>,
    @InjectRepository(Vendedor)
    private readonly vendedoresRepository: Repository<Vendedor>,
  ) {}

  async create(createProductoDto: CreateProductoDto) {
    assertAllowedImageUrls([
      createProductoDto.imagenUrl,
      createProductoDto.imagenUrl2,
      createProductoDto.imagenUrl3,
      createProductoDto.imagenUrl4,
    ]);
    if (!createProductoDto.vendedorId) {
      throw new BadRequestException(
        'El producto debe estar asignado a un usuario',
      );
    }

    const vendedor = await this.vendedoresRepository.findOne({
      where: { id: createProductoDto.vendedorId },
    });
    if (!vendedor) {
      throw new NotFoundException('Vendedor no encontrado');
    }

    const producto = this.productosRepository.create({
      nombre: createProductoDto.nombre,
      descripcion: createProductoDto.descripcion,
      categoria: createProductoDto.categoria,
      subcategoria: createProductoDto.subcategoria ?? null,
      imagenUrl: createProductoDto.imagenUrl ?? null,
      imagenUrl2: createProductoDto.imagenUrl2 ?? null,
      imagenUrl3: createProductoDto.imagenUrl3 ?? null,
      imagenUrl4: createProductoDto.imagenUrl4 ?? null,
      vendedorId: vendedor.id,
      destacado: normalizarBooleano(createProductoDto.destacado),
    });

    return this.productosRepository.save(producto);
  }

  findAll(vendedorId?: number, page = 1, pageSize = 50) {
    const pagination = { skip: (page - 1) * pageSize, take: pageSize };
    if (vendedorId) {
      return this.productosRepository.find({
        where: { vendedorId },
        order: { id: 'DESC' },
        ...pagination,
      });
    }

    return this.productosRepository.find({
      order: { id: 'DESC' },
      ...pagination,
    });
  }

  async findCatalog(query: CatalogoProductosQueryDto) {
    const builder = this.productosRepository
      .createQueryBuilder('producto')
      .orderBy('producto.id', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);

    if (query.categoria) {
      builder.andWhere('producto.categoria = :categoria', {
        categoria: query.categoria,
      });
    }
    if (query.subcategoria) {
      builder.andWhere('producto.subcategoria = :subcategoria', {
        subcategoria: query.subcategoria,
      });
    }
    if (query.busqueda) {
      builder.andWhere(
        '(producto.nombre ILIKE :busqueda OR producto.descripcion ILIKE :busqueda)',
        { busqueda: `%${query.busqueda}%` },
      );
    }

    const [productos, total] = await builder.getManyAndCount();
    const items = await this.withSellerNames(productos);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async findFeatured(limit: number) {
    const productos = await this.productosRepository.find({
      where: { destacado: true },
      order: { id: 'DESC' },
      take: limit,
    });
    return this.withSellerNames(productos);
  }

  async findCatalogFilters() {
    const rows = await this.productosRepository
      .createQueryBuilder('producto')
      .select('producto.categoria', 'categoria')
      .addSelect('producto.subcategoria', 'subcategoria')
      .where("producto.categoria <> ''")
      .groupBy('producto.categoria')
      .addGroupBy('producto.subcategoria')
      .orderBy('producto.categoria', 'ASC')
      .addOrderBy('producto.subcategoria', 'ASC')
      .getRawMany<{ categoria: string; subcategoria: string | null }>();

    const categorias = [...new Set(rows.map(({ categoria }) => categoria))];
    const subcategoriasPorCategoria = Object.fromEntries(
      categorias.map((categoria) => [
        categoria,
        rows
          .filter((row) => row.categoria === categoria && row.subcategoria)
          .map(({ subcategoria }) => subcategoria as string),
      ]),
    );

    return {
      categorias,
      subcategoriasPorCategoria,
    };
  }

  private async withSellerNames(productos: Producto[]) {
    const sellerIds = [
      ...new Set(productos.map(({ vendedorId }) => vendedorId).filter(Boolean)),
    ];
    if (sellerIds.length === 0) return [];

    const vendedores = await this.vendedoresRepository.find({
      select: { id: true, nombre: true },
      where: { id: In(sellerIds) },
    });
    const sellerNames = new Map(
      vendedores.map(({ id, nombre }) => [id, nombre]),
    );

    return productos.map((producto) => ({
      ...producto,
      vendedorNombre: sellerNames.get(producto.vendedorId) ?? null,
    }));
  }

  async findOne(id: number) {
    const producto = await this.productosRepository.findOne({ where: { id } });
    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }
    return producto;
  }

  async update(id: number, updateProductoDto: UpdateProductoDto) {
    assertAllowedImageUrls([
      updateProductoDto.imagenUrl,
      updateProductoDto.imagenUrl2,
      updateProductoDto.imagenUrl3,
      updateProductoDto.imagenUrl4,
    ]);
    const producto = await this.findOne(id);

    if (updateProductoDto.vendedorId !== undefined) {
      if (updateProductoDto.vendedorId === null) {
        throw new BadRequestException(
          'Un producto siempre debe pertenecer a un usuario',
        );
      } else {
        const vendedor = await this.vendedoresRepository.findOne({
          where: { id: updateProductoDto.vendedorId },
        });
        if (!vendedor) {
          throw new NotFoundException('Vendedor no encontrado');
        }
        producto.vendedorId = vendedor.id;
      }
    }

    Object.assign(producto, {
      nombre: updateProductoDto.nombre ?? producto.nombre,
      descripcion: updateProductoDto.descripcion ?? producto.descripcion,
      categoria: updateProductoDto.categoria ?? producto.categoria,
      subcategoria:
        updateProductoDto.subcategoria !== undefined
          ? updateProductoDto.subcategoria
          : producto.subcategoria,
      imagenUrl:
        updateProductoDto.imagenUrl !== undefined
          ? updateProductoDto.imagenUrl
          : producto.imagenUrl,
      imagenUrl2:
        updateProductoDto.imagenUrl2 !== undefined
          ? updateProductoDto.imagenUrl2
          : producto.imagenUrl2,
      imagenUrl3:
        updateProductoDto.imagenUrl3 !== undefined
          ? updateProductoDto.imagenUrl3
          : producto.imagenUrl3,
      imagenUrl4:
        updateProductoDto.imagenUrl4 !== undefined
          ? updateProductoDto.imagenUrl4
          : producto.imagenUrl4,
      destacado:
        updateProductoDto.destacado !== undefined
          ? normalizarBooleano(updateProductoDto.destacado)
          : producto.destacado,
    });

    return this.productosRepository.save(producto);
  }

  async remove(id: number) {
    const producto = await this.findOne(id);
    await this.productosRepository.remove(producto);
    return { deleted: true, id };
  }
}
