import { readFileSync } from 'node:fs';

type Environment = Record<string, string | undefined>;

const FILE_BACKED_SECRETS = [
  'DB_PASSWORD',
  'JWT_SECRET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
] as const;

export function resolveEnvironment(env: Environment): Environment {
  const resolved = { ...env };

  for (const name of FILE_BACKED_SECRETS) {
    const file = env[`${name}_FILE`]?.trim();
    if (!file) continue;

    try {
      resolved[name] = readFileSync(file, 'utf8').trim();
    } catch {
      throw new Error(`No se pudo leer el archivo configurado para ${name}`);
    }
  }

  return resolved;
}

const required = (env: Environment, name: string) => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
};

export function validateEnvironment(env: Environment) {
  const resolved = resolveEnvironment(env);
  required(resolved, 'DB_PASSWORD');
  const port = Number(resolved.DB_PORT ?? 5433);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT debe ser un puerto valido');
  }

  if (resolved.NODE_ENV === 'production') {
    const jwtSecret = required(resolved, 'JWT_SECRET');
    if (jwtSecret.length < 32) {
      throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
    }
    required(resolved, 'FRONTEND_URL');
  }

  const s3Values = [
    resolved.S3_BUCKET,
    resolved.S3_ACCESS_KEY_ID,
    resolved.S3_SECRET_ACCESS_KEY,
  ];
  if (s3Values.some(Boolean) && s3Values.some((value) => !value?.trim())) {
    throw new Error(
      'S3_BUCKET, S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY deben configurarse juntos',
    );
  }

  return resolved;
}
