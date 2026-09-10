import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ProductosService } from './productos.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { Public } from '../../auth/public.decorator';
import { Roles } from '../../auth/roles.decorator';
import { ProductosQueryDto } from './dto/productos-query.dto';
import { CatalogoProductosQueryDto } from './dto/catalogo-productos-query.dto';
import { DestacadosQueryDto } from './dto/destacados-query.dto';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/auth.types';

@Controller('productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Post()
  @Roles('administrador')
  create(@Body() createProductoDto: CreateProductoDto) {
    return this.productosService.create(createProductoDto);
  }

  @Get()
  @Public()
  findAll(@Query() query: ProductosQueryDto) {
    return this.productosService.findAll(
      query.vendedorId,
      query.page,
      query.pageSize,
    );
  }

  @Get('mios')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.productosService.findAll(user.sub);
  }

  @Get('catalogo')
  @Public()
  findCatalog(@Query() query: CatalogoProductosQueryDto) {
    return this.productosService.findCatalog(query);
  }

  @Get('destacados')
  @Public()
  findFeatured(@Query() query: DestacadosQueryDto) {
    return this.productosService.findFeatured(query.limit);
  }

  @Get('filtros')
  @Public()
  findCatalogFilters() {
    return this.productosService.findCatalogFilters();
  }

  @Get(':id')
  @Public()
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productosService.findOne(id);
  }

  @Patch(':id')
  @Roles('administrador')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductoDto: UpdateProductoDto,
  ) {
    return this.productosService.update(id, updateProductoDto);
  }

  @Delete(':id')
  @Roles('administrador')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productosService.remove(id);
  }
}
