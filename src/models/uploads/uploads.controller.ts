import {
  Controller,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
  FileTypeValidator,
  BadRequestException,
  Get,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { UploadsService } from './uploads.service';
import { Public } from '../../auth/public.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('images/:folder')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  uploadImage(
    @Param('folder') folder: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp|gif)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    if (folder !== 'productos' && folder !== 'vendedores') {
      throw new BadRequestException('La carpeta de destino no es valida.');
    }
    return this.uploadsService.uploadImage(file, folder);
  }

  @Get('image')
  @Public()
  async getImage(
    @Query('key') key: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (
      !key ||
      (!key.startsWith('productos/') && !key.startsWith('vendedores/'))
    ) {
      throw new BadRequestException('La clave de imagen no es valida.');
    }

    const image = await this.uploadsService.getImage(key);
    response.set({
      'Content-Type': image.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    return new StreamableFile(image.bytes);
  }
}
