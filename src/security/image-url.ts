import { BadRequestException } from '@nestjs/common';

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

function isWithinBase(candidate: URL, configuredBase: string): boolean {
  try {
    const base = new URL(trimTrailingSlashes(configuredBase));
    if (candidate.protocol !== base.protocol || candidate.host !== base.host) {
      return false;
    }

    const basePath = trimTrailingSlashes(base.pathname);
    return (
      candidate.pathname === basePath ||
      candidate.pathname.startsWith(`${basePath}/`)
    );
  } catch {
    return false;
  }
}

export function assertAllowedImageUrl(
  value: string | null | undefined,
  environment: NodeJS.ProcessEnv = process.env,
): void {
  if (value === null || value === undefined || value === '') return;

  let candidate: URL;
  try {
    candidate = new URL(value);
  } catch {
    throw new BadRequestException('La URL de imagen no es valida');
  }

  if (!['http:', 'https:'].includes(candidate.protocol)) {
    throw new BadRequestException('La URL de imagen no esta permitida');
  }

  const s3Base = environment.S3_PUBLIC_URL?.trim();
  const apiRoot = (environment.API_URL ?? environment.PUBLIC_API_URL)?.trim();
  const apiUploadsBase = apiRoot
    ? `${trimTrailingSlashes(apiRoot)}/api/v1/uploads`
    : undefined;
  const explicitApiUploadsBase = environment.API_URL
    ? `${trimTrailingSlashes(environment.API_URL)}/uploads`
    : undefined;

  const allowedBases = [s3Base, apiUploadsBase, explicitApiUploadsBase].filter(
    (base): base is string => Boolean(base),
  );
  if (!allowedBases.some((base) => isWithinBase(candidate, base))) {
    throw new BadRequestException(
      'La imagen debe pertenecer al almacenamiento publico configurado',
    );
  }
}

export function assertAllowedImageUrls(
  values: Array<string | null | undefined>,
  environment: NodeJS.ProcessEnv = process.env,
): void {
  values.forEach((value) => assertAllowedImageUrl(value, environment));
}
