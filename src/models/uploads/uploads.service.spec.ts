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

  it.each([
    'productos/2026-08-25/123e4567-e89b-42d3-a456-426614174000.jpg',
    'vendedores/2026-08-25/123e4567-e89b-42d3-a456-426614174000.png',
    'productos/importados/15/inicial-a1b2c3d4e5f67890.webp',
    'productos/importados/15/final-a1b2c3d4e5f67890.jpeg',
    'vendedores/importados/8/logo-a1b2c3d4e5f67890.gif',
  ])('acepta una clave de imagen generada por la aplicacion: %s', (key) => {
    const service = new UploadsService();

    expect(() => service.validateImageKey(key)).not.toThrow();
  });

  it.each([
    'productos/../../secreto.json',
    'productos/documento.html',
    'vendedores/carpeta-arbitraria/imagen.jpg',
    'productos/importados/15/otra-a1b2c3d4e5f67890.jpg',
    'otro/2026-08-25/123e4567-e89b-42d3-a456-426614174000.jpg',
  ])('rechaza una clave fuera de los formatos permitidos: %s', (key) => {
    const service = new UploadsService();

    expect(() => service.validateImageKey(key)).toThrow(BadRequestException);
  });

  it('rechaza un objeto cuyo contenido no coincide con la extension validada', async () => {
    const service = new UploadsService();
    const pngBytes = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    const storageClient = (
      service as unknown as { client: { send: jest.Mock } }
    ).client;
    storageClient.send = jest.fn().mockResolvedValue({
      Body: { transformToByteArray: jest.fn().mockResolvedValue(pngBytes) },
      ContentType: 'text/html',
    });

    await expect(
      service.getImage(
        'productos/2026-08-25/123e4567-e89b-42d3-a456-426614174000.jpg',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
