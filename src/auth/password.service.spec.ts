import { createHash } from 'node:crypto';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('genera hashes Argon2id diferentes para la misma contraseña', async () => {
    const first = await service.hash('UnacontraseñaSegura-2026');
    const second = await service.hash('UnacontraseñaSegura-2026');
    expect(first).toMatch(/^\$argon2id\$/);
    expect(second).not.toBe(first);
    await expect(
      service.verify(first, 'UnacontraseñaSegura-2026'),
    ).resolves.toEqual({
      valid: true,
      legacy: false,
    });
  });

  it('detecta hashes SHA-256 legados para exigir cambio de contraseña', async () => {
    const legacy = createHash('sha256').update('password-legado').digest('hex');
    await expect(service.verify(legacy, 'password-legado')).resolves.toEqual({
      valid: true,
      legacy: true,
    });
  });
});
