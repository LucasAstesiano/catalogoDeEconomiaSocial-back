import { BadRequestException } from '@nestjs/common';
import { assertAllowedImageUrl } from './image-url';

describe('assertAllowedImageUrl', () => {
  const environment = {
    S3_PUBLIC_URL: 'https://cdn.example/bucket',
    PUBLIC_API_URL: 'https://api.example',
  } as NodeJS.ProcessEnv;

  it.each([
    'https://cdn.example/bucket/productos/imagen.webp',
    'https://api.example/api/v1/uploads/image?key=productos%2Fimagen.webp',
  ])('acepta una URL de la allowlist: %s', (url) => {
    expect(() => assertAllowedImageUrl(url, environment)).not.toThrow();
  });

  it.each([
    'https://cdn.example.evil.test/bucket/productos/imagen.webp',
    'https://cdn.example/bucket-falso/productos/imagen.webp',
    'https://api.example.evil.test/api/v1/uploads/image',
    'file:///etc/passwd',
  ])('rechaza una URL fuera de la allowlist: %s', (url) => {
    expect(() => assertAllowedImageUrl(url, environment)).toThrow(
      BadRequestException,
    );
  });
});
