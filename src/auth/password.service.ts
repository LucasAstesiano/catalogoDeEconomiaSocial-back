import { Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  hash(password: string) {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async verify(storedHash: string, password: string) {
    if (storedHash.startsWith('$argon2')) {
      return {
        valid: await argon2.verify(storedHash, password),
        legacy: false,
      };
    }

    const legacyHash = createHash('sha256').update(password).digest('hex');
    const valid =
      storedHash.length === legacyHash.length &&
      timingSafeEqual(Buffer.from(storedHash), Buffer.from(legacyHash));
    return { valid, legacy: valid };
  }
}
