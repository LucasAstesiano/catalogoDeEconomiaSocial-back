import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { VendedoresService } from './vendedores.service';
import { CreateVendedoreDto } from './dto/create-vendedore.dto';
import { UpdateVendedoreDto } from './dto/update-vendedore.dto';
import { LoginVendedoreDto } from './dto/login-vendedore.dto';
import { ChangePasswordVendedoreDto } from './dto/change-password-vendedore.dto';
import { UpdateLogoVendedoreDto } from './dto/update-logo-vendedore.dto';

@Controller('vendedores')
export class VendedoresController {
  constructor(private readonly vendedoresService: VendedoresService) {}

  @Post()
  create(@Body() createVendedoreDto: CreateVendedoreDto) {
    return this.vendedoresService.create(createVendedoreDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginVendedoreDto) {
    return this.vendedoresService.login(loginDto);
  }

  @Get()
  findAll() {
    return this.vendedoresService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vendedoresService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateVendedoreDto: UpdateVendedoreDto) {
    return this.vendedoresService.update(+id, updateVendedoreDto);
  }

  @Patch(':id/logo')
  updateLogo(@Param('id') id: string, @Body() updateLogoDto: UpdateLogoVendedoreDto) {
    return this.vendedoresService.updateLogo(+id, updateLogoDto.logoUrl ?? null);
  }

  @Patch('passwords/reset-default')
  resetAllPasswordsToDefault() {
    return this.vendedoresService.resetAllPasswordsToDefault();
  }

  @Patch(':id/password')
  changePassword(
    @Param('id') id: string,
    @Body() changePasswordDto: ChangePasswordVendedoreDto,
  ) {
    return this.vendedoresService.changePassword(
      +id,
      String(changePasswordDto.currentPassword ?? ''),
      String(changePasswordDto.newPassword ?? ''),
    );
  }

  @Patch(':id/administrador')
  makeAdministrator(@Param('id') id: string) {
    return this.vendedoresService.makeAdministrator(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vendedoresService.remove(+id);
  }
}
