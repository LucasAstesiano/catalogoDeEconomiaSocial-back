import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Public } from '../../auth/public.decorator';
import { Roles } from '../../auth/roles.decorator';
import { CategoriasService } from './categorias.service';
import { CategoriaDto, CreateCategoriaDto } from './dto/categoria.dto';

@Controller('categorias')
export class CategoriasController {
  constructor(private readonly service: CategoriasService) {}
  @Get() @Public() list() {
    return this.service.list();
  }
  @Get('dashboard') @Roles('administrador') dashboard() {
    return this.service.dashboard();
  }
  @Post() @Roles('administrador') create(@Body() body: CreateCategoriaDto) {
    return this.service.create(body.nombre, body.iconoUrl);
  }
  @Patch(':id') @Roles('administrador') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CategoriaDto,
  ) {
    return this.service.update(id, body.nombre);
  }
  @Delete(':id') @Roles('administrador') remove(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.remove(id);
  }
}
