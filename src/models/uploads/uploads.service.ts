import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { GetObjectCommandOutput } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { Readable, Transform } from 'node:stream';
import { resolveEnvironment } from '../../config/environment';

export type ImageFolder = 'productos' | 'vendedores';

@Injectable()
export class UploadsService {
  private static readonly MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  private static readonly MANUAL_IMAGE_KEY =
    /^(productos|vendedores)\/\d{4}-\d{2}-\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|gif)$/i;
  private static readonly IMPORTED_PRODUCT_IMAGE_KEY =
    /^productos\/importados\/\d+\/(inicial|final)-[0-9a-f]{16}\.(jpg|jpeg|png|webp|gif)$/i;
  private static readonly IMPORTED_VENDOR_IMAGE_KEY =
    /^vendedores\/importados\/\d+\/logo-[0-9a-f]{16}\.(jpg|jpeg|png|webp|gif)$/i;
  private static readonly CONTENT_TYPES: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };

  private readonly logger = new Logger(UploadsService.name);
  private readonly environment = resolveEnvironment(process.env);
  private readonly bucket = this.environment.S3_BUCKET;
  private readonly client = this.bucket
    ? new S3Client({
        region: this.environment.S3_REGION ?? 'us-east-1',
        endpoint: this.environment.S3_ENDPOINT || undefined,
        forcePathStyle: this.environment.S3_FORCE_PATH_STYLE === 'true',
        credentials:
          this.environment.S3_ACCESS_KEY_ID &&
          this.environment.S3_SECRET_ACCESS_KEY
            ? {
                accessKeyId: this.environment.S3_ACCESS_KEY_ID,
                secretAccessKey: this.environment.S3_SECRET_ACCESS_KEY,
              }
            : undefined,
      })
    : null;

  async uploadImage(file: Express.Multer.File, folder: ImageFolder) {
    if (!this.client || !this.bucket) {
      throw new ServiceUnavailableException(
        'El almacenamiento S3 no se encuentra configurado.',
      );
    }

    const detectedMime = this.detectImageMime(file.buffer);
    const allowedMimeTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ]);
    if (!detectedMime || !allowedMimeTypes.has(detectedMime)) {
      throw new BadRequestException(
        'El contenido del archivo no corresponde a una imagen permitida.',
      );
    }
    if (detectedMime !== file.mimetype) {
      throw new BadRequestException(
        'El tipo declarado del archivo no coincide con su contenido.',
      );
    }

    const extension = this.safeExtension(file.originalname, detectedMime);
    const key = `${folder}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    } catch (error) {
      this.logStorageError('put_object', error);
      throw new InternalServerErrorException(
        'No se pudo guardar la imagen en S3.',
      );
    }

    return { url: this.publicUrl(key), key };
  }

  async getImage(key: string) {
    if (!this.client || !this.bucket) {
      throw new ServiceUnavailableException(
        'El almacenamiento S3 no se encuentra configurado.',
      );
    }

    const expectedContentType = this.validateImageKey(key);
    let object: GetObjectCommandOutput;

    try {
      object = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      this.logStorageError('get_object', error);
      throw new InternalServerErrorException(
        'No se pudo obtener la imagen de S3.',
      );
    }

    if (!object.Body || !(object.Body instanceof Readable)) {
      throw new BadRequestException(
        'El objeto solicitado no corresponde a una imagen valida.',
      );
    }
    if (
      typeof object.ContentLength === 'number' &&
      object.ContentLength > UploadsService.MAX_IMAGE_BYTES
    ) {
      object.Body.destroy();
      throw new BadRequestException('La imagen solicitada excede el limite.');
    }

    return {
      stream: this.limitStream(object.Body),
      // Nunca confiar en ContentType de S3: la clave validada determina el MIME.
      contentType: expectedContentType,
    };
  }

  validateImageKey(key: string) {
    const validKey =
      typeof key === 'string' &&
      (UploadsService.MANUAL_IMAGE_KEY.test(key) ||
        UploadsService.IMPORTED_PRODUCT_IMAGE_KEY.test(key) ||
        UploadsService.IMPORTED_VENDOR_IMAGE_KEY.test(key));
    if (!validKey) {
      throw new BadRequestException('La clave de imagen no es valida.');
    }

    const contentType =
      UploadsService.CONTENT_TYPES[extname(key).toLowerCase()];
    if (!contentType) {
      throw new BadRequestException('La extension de imagen no es valida.');
    }
    return contentType;
  }

  private safeExtension(filename: string, mimeType: string) {
    const allowed: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };
    return allowed[mimeType] ?? extname(filename).toLowerCase();
  }

  private detectImageMime(buffer: Buffer): string | null {
    if (
      buffer.length >= 3 &&
      buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    ) {
      return 'image/jpeg';
    }
    if (
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ) {
      return 'image/png';
    }
    const header = buffer.subarray(0, 6).toString('ascii');
    if (header === 'GIF87a' || header === 'GIF89a') return 'image/gif';
    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'image/webp';
    }
    return null;
  }

  private limitStream(source: Readable) {
    let transferred = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        transferred += chunk.length;
        if (transferred > UploadsService.MAX_IMAGE_BYTES) {
          callback(new Error('La imagen excede el limite permitido.'));
          return;
        }
        callback(null, chunk);
      },
    });
    return source.pipe(limiter);
  }

  private publicUrl(key: string) {
    const publicBase = this.environment.S3_PUBLIC_URL?.replace(/\/$/, '');
    if (publicBase) {
      return `${publicBase}/${key}`;
    }

    const region = this.environment.S3_REGION ?? 'us-east-1';
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  private logStorageError(operation: string, error: unknown) {
    const storageError = error as {
      name?: string;
      Code?: string;
      $metadata?: { httpStatusCode?: number; requestId?: string };
    };
    this.logger.error(
      JSON.stringify({
        event: 's3_operation_failed',
        operation,
        errorName: storageError?.name ?? 'UnknownError',
        errorCode: storageError?.Code ?? null,
        httpStatusCode: storageError?.$metadata?.httpStatusCode ?? null,
        requestId: storageError?.$metadata?.requestId ?? null,
      }),
    );
  }
}
