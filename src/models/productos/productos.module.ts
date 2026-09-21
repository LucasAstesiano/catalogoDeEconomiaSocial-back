import { Module } from '@nestjs/common';
import { ProductosService } from './productos.service';
import { ProductosController } from './productos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Producto } from './entities/producto.entity';
import { Vendedor } from '../vendedores/entities/vendedore.entity';
import { Categoria } from '../categorias/entities/categoria.entity';
import { Subcategoria } from '../categorias/entities/subcategoria.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Producto, Vendedor, Categoria, Subcategoria]),
  ],
  controllers: [ProductosController],
  providers: [ProductosService],
})
export class ProductosModule {}
