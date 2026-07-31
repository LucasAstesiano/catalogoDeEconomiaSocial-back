import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { Producto } from './entities/producto.entity';
import { Vendedor} from '../vendedores/entities/vendedore.entity';

const normalizarBooleano = (valor: unknown): boolean => {
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return valor === 1;
  if (typeof valor === 'string') {
    const normalizado = valor.trim().toLowerCase();
    if (['true', '1', 'si', 'sí', 'yes', 'on'].includes(normalizado)) return true;
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
    if (!createProductoDto.vendedorId) {
      throw new BadRequestException('El producto debe estar asignado a un usuario');
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

  findAll(vendedorId?: number) {
    if (vendedorId) {
      return this.productosRepository.find({
        where: { vendedorId },
        order: { id: 'DESC' },
      });
    }

    return this.productosRepository.find({
      order: { id: 'DESC' },
    });
  }

  async findOne(id: number) {
    const producto = await this.productosRepository.findOne({ where: { id } });
    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }
    return producto;
  }

  async update(id: number, updateProductoDto: UpdateProductoDto) {
    const producto = await this.findOne(id);

    if (updateProductoDto.vendedorId !== undefined) {
      if (updateProductoDto.vendedorId === null) {
        throw new BadRequestException('Un producto siempre debe pertenecer a un usuario');
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
