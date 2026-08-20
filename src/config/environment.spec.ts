import { validateEnvironment } from './environment';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('validateEnvironment', () => {
  it('rechaza una configuracion sin password de base de datos', () => {
    expect(() => validateEnvironment({})).toThrow('DB_PASSWORD');
  });

  it('rechaza configuraciones S3 incompletas', () => {
    expect(() =>
      validateEnvironment({ DB_PASSWORD: 'segura', S3_BUCKET: 'bucket' }),
    ).toThrow('deben configurarse juntos');
  });

  it('acepta una configuracion de desarrollo valida', () => {
    expect(validateEnvironment({ DB_PASSWORD: 'segura' })).toBeDefined();
  });

  it('resuelve secretos desde archivos montados', () => {
    const directory = mkdtempSync(join(tmpdir(), 'catalogo-secrets-'));
    const passwordFile = join(directory, 'db_password');
    writeFileSync(passwordFile, 'secreto-desde-archivo\n', { mode: 0o600 });

    try {
      const environment = validateEnvironment({
        DB_PASSWORD_FILE: passwordFile,
      });
      expect(environment.DB_PASSWORD).toBe('secreto-desde-archivo');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rechaza un archivo de secreto inexistente', () => {
    expect(() =>
      validateEnvironment({ DB_PASSWORD_FILE: '/ruta/inexistente' }),
    ).toThrow('DB_PASSWORD');
  });
});
