import { Module } from '@nestjs/common';
import { ProductosService } from './productos.service';
import { ProductosController } from './productos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Producto } from './entities/producto.entity';
import { Vendedor } from '../vendedores/entities/vendedore.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Producto, Vendedor])],
  controllers: [ProductosController],
  providers: [ProductosService],
})
export class ProductosModule {}
