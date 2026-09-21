import type { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeWhatsappNumbers1789600000000 implements MigrationInterface {
  name = 'NormalizeWhatsappNumbers1789600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH numeros AS (
        SELECT id, regexp_replace(whatsapp, '\\D', '', 'g') AS digitos
        FROM vendedores
        WHERE whatsapp IS NOT NULL
      )
      UPDATE vendedores AS vendedor
      SET whatsapp = CASE
        WHEN numeros.digitos ~ '^549[0-9]{10}$' THEN numeros.digitos
        WHEN numeros.digitos ~ '^54[0-9]{10}$' THEN '549' || substring(numeros.digitos FROM 3)
        WHEN numeros.digitos ~ '^[0-9]{10}$' THEN '549' || numeros.digitos
        ELSE vendedor.whatsapp
      END
      FROM numeros
      WHERE vendedor.id = numeros.id
    `);
  }

  async down(): Promise<void> {
    // La normalización no es reversible sin conservar el formato original.
  }
}
