import { BadRequestException } from '@nestjs/common';
import { UploadsService } from './uploads.service';

describe('UploadsService', () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnvironment,
      S3_BUCKET: 'test-bucket',
      S3_REGION: 'us-east-1',
    };
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it('rechaza contenido que no es una imagen aunque declare un MIME permitido', async () => {
    const service = new UploadsService();
    const file = {
      buffer: Buffer.from('esto no es una imagen'),
      mimetype: 'image/png',
      originalname: 'archivo.png',
    } as Express.Multer.File;

    await expect(service.uploadImage(file, 'productos')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza cuando la firma binaria y el MIME declarado no coinciden', async () => {
    const service = new UploadsService();
    const pngSignature = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    const file = {
      buffer: pngSignature,
      mimetype: 'image/jpeg',
      originalname: 'archivo.jpg',
    } as Express.Multer.File;

    await expect(service.uploadImage(file, 'productos')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
