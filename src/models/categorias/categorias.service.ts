import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Producto } from '../productos/entities/producto.entity';
import { Categoria } from './entities/categoria.entity';
import { assertAllowedImageUrl } from '../../security/image-url';

@Injectable()
export class CategoriasService {
  constructor(
    @InjectRepository(Categoria)
    private readonly categorias: Repository<Categoria>,
    @InjectRepository(Producto)
    private readonly productos: Repository<Producto>,
  ) {}

  list() {
    return this.categorias.find({ order: { nombre: 'ASC' } });
  }

  async dashboard() {
    const [productos, vendedores, solicitudes] = await Promise.all([
      this.productos.count(),
      this.productos
        .createQueryBuilder('p')
        .select('COUNT(DISTINCT p.vendedor_id)', 'total')
        .getRawOne<{ total: string }>(),
      this.productos
        .createQueryBuilder('p')
        .select('COUNT(*)', 'total')
        .where('p.destacado = true')
        .getRawOne<{ total: string }>(),
    ]);
    return {
      productos,
      vendedores: Number(vendedores?.total ?? 0),
      destacados: Number(solicitudes?.total ?? 0),
    };
  }

  async create(nombre: string, iconoUrl: string) {
    const limpio = nombre.trim();
    if (limpio.length < 2)
      throw new BadRequestException(
        'El nombre debe tener al menos 2 caracteres.',
      );
    const existente = await this.categorias.findOne({
      where: { nombre: limpio },
    });
    if (existente) throw new BadRequestException('La categoría ya existe.');
    assertAllowedImageUrl(iconoUrl);
    const iconKey =
      new URL(iconoUrl).searchParams.get('key') ?? new URL(iconoUrl).pathname;
    if (!decodeURIComponent(iconKey).startsWith('categorias/')) {
      throw new BadRequestException(
        'El icono debe cargarse en el almacenamiento de categorías.',
      );
    }
    return this.categorias.save(
      this.categorias.create({ nombre: limpio, iconoUrl }),
    );
  }

  async update(id: number, nombre: string) {
    const categoria = await this.categorias.findOne({ where: { id } });
    if (!categoria) throw new NotFoundException('Categoría no encontrada.');
    const limpio = nombre.trim();
    if (limpio.length < 2)
      throw new BadRequestException(
        'El nombre debe tener al menos 2 caracteres.',
      );
    categoria.nombre = limpio;
    const actualizada = await this.categorias.save(categoria);
    await this.productos.update({ categoriaId: id }, { categoria: limpio });
    return actualizada;
  }

  async remove(id: number) {
    const categoria = await this.categorias.findOne({ where: { id } });
    if (!categoria) throw new NotFoundException('Categoría no encontrada.');
    const asociados = await this.productos.count({
      where: { categoriaId: id },
    });
    if (asociados > 0)
      throw new BadRequestException(
        'No se puede eliminar una categoría con productos asociados.',
      );
    await this.categorias.remove(categoria);
    return { deleted: true, id };
  }
}
