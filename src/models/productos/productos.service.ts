import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { Producto } from './entities/producto.entity';
import { Vendedor } from '../vendedores/entities/vendedore.entity';
import { assertAllowedImageUrls } from '../../security/image-url';
import { CatalogoProductosQueryDto } from './dto/catalogo-productos-query.dto';
import { Categoria } from '../categorias/entities/categoria.entity';
import { Subcategoria } from '../categorias/entities/subcategoria.entity';

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
    @InjectRepository(Categoria)
    private readonly categoriasRepository: Repository<Categoria>,
    @InjectRepository(Subcategoria)
    private readonly subcategoriasRepository: Repository<Subcategoria>,
  ) {}

  private async resolveCategoria(nombre: string) {
    const categoria = await this.categoriasRepository.findOne({
      where: { nombre: nombre.trim(), activa: true },
    });
    if (!categoria)
      throw new BadRequestException(
        'La categoría seleccionada no existe o no está activa.',
      );
    return categoria;
  }

  private async resolveSubcategoria(
    nombre: string | null | undefined,
    categoriaId: number,
  ) {
    if (!nombre?.trim()) return null;
    const subcategoria = await this.subcategoriasRepository.findOne({
      where: { nombre: nombre.trim(), categoriaId },
    });
    if (!subcategoria)
      throw new BadRequestException(
        'La subcategoría seleccionada no pertenece a la categoría indicada.',
      );
    return subcategoria;
  }

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

    const categoria = await this.resolveCategoria(createProductoDto.categoria);
    const subcategoria = await this.resolveSubcategoria(
      createProductoDto.subcategoria,
      categoria.id,
    );
    const producto = this.productosRepository.create({
      nombre: createProductoDto.nombre,
      descripcion: createProductoDto.descripcion,
      categoria: categoria.nombre,
      categoriaId: categoria.id,
      subcategoria: subcategoria?.nombre ?? null,
      subcategoriaId: subcategoria?.id ?? null,
      imagenUrl: createProductoDto.imagenUrl ?? null,
      imagenUrl2: createProductoDto.imagenUrl2 ?? null,
      imagenUrl3: createProductoDto.imagenUrl3 ?? null,
      imagenUrl4: createProductoDto.imagenUrl4 ?? null,
      vendedorId: vendedor.id,
      destacado: normalizarBooleano(createProductoDto.destacado),
    });

    return this.productosRepository.save(producto);
  }

  findAll(vendedorId?: number, page = 1, pageSize = 50, busqueda?: string) {
    const pagination = { skip: (page - 1) * pageSize, take: pageSize };
    const termino = busqueda?.trim();
    if (termino) {
      const patron = `%${termino}%`;
      return this.productosRepository.find({
        where: [
          { ...(vendedorId ? { vendedorId } : {}), nombre: ILike(patron) },
          {
            ...(vendedorId ? { vendedorId } : {}),
            descripcion: ILike(patron),
          },
          { ...(vendedorId ? { vendedorId } : {}), categoria: ILike(patron) },
          {
            ...(vendedorId ? { vendedorId } : {}),
            subcategoria: ILike(patron),
          },
        ],
        order: { id: 'DESC' },
        ...pagination,
      });
    }
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

    let categoria: Categoria | null = null;
    if (query.categoria) {
      categoria = await this.categoriasRepository.findOne({
        where: { nombre: query.categoria, activa: true },
      });
      if (!categoria) return this.emptyCatalog(query);
      builder.andWhere('producto.categoria_id = :categoriaId', {
        categoriaId: categoria.id,
      });
    }
    if (query.subcategoria) {
      const subcategoria = await this.resolveSubcategoria(
        query.subcategoria,
        categoria?.id ?? -1,
      );
      if (!subcategoria) return this.emptyCatalog(query);
      builder.andWhere('producto.subcategoria_id = :subcategoriaId', {
        subcategoriaId: subcategoria.id,
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

  private emptyCatalog(query: CatalogoProductosQueryDto) {
    return {
      items: [],
      total: 0,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: 1,
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
    const rows = await this.categoriasRepository
      .createQueryBuilder('categoria')
      .leftJoin(
        'subcategorias',
        'subcategoria',
        'subcategoria.categoria_id = categoria.id',
      )
      .select('categoria.nombre', 'categoria')
      .addSelect('subcategoria.nombre', 'subcategoria')
      .where('categoria.activa = true')
      .orderBy('categoria.nombre', 'ASC')
      .addOrderBy('subcategoria.nombre', 'ASC')
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

    const categoria =
      updateProductoDto.categoria !== undefined
        ? await this.resolveCategoria(updateProductoDto.categoria)
        : null;
    const nextCategoriaId = categoria?.id ?? producto.categoriaId;
    const subcategoria =
      updateProductoDto.subcategoria !== undefined
        ? await this.resolveSubcategoria(
            updateProductoDto.subcategoria,
            nextCategoriaId,
          )
        : null;
    Object.assign(producto, {
      nombre: updateProductoDto.nombre ?? producto.nombre,
      descripcion: updateProductoDto.descripcion ?? producto.descripcion,
      categoria: categoria?.nombre ?? producto.categoria,
      categoriaId: nextCategoriaId,
      subcategoria:
        subcategoria?.nombre ??
        (categoria || updateProductoDto.subcategoria !== undefined
          ? null
          : producto.subcategoria),
      subcategoriaId:
        subcategoria?.id ??
        (categoria || updateProductoDto.subcategoria !== undefined
          ? null
          : producto.subcategoriaId),
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
