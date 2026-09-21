import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Producto } from '../productos/entities/producto.entity';
import { Vendedor } from '../vendedores/entities/vendedore.entity';
import { Solicitud } from './entities/solicitud.entity';
import { Categoria } from '../categorias/entities/categoria.entity';
import { Subcategoria } from '../categorias/entities/subcategoria.entity';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Solicitud,
      Vendedor,
      Producto,
      Categoria,
      Subcategoria,
    ]),
  ],
  controllers: [SolicitudesController],
  providers: [SolicitudesService],
})
export class SolicitudesModule {}
