import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendedoresModule } from './models/vendedores/vendedores.module';
import { ProductosModule } from './models/productos/productos.module';
import { SolicitudesModule } from './models/solicitudes/solicitudes.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5433),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'kuki30222002',
      database: process.env.DB_NAME ?? 'db-catalogo',
      autoLoadEntities: true,
      synchronize: true,
    }),
    VendedoresModule,
    ProductosModule,
    SolicitudesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
