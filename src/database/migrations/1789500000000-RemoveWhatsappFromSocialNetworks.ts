import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveWhatsappFromSocialNetworks1789500000000 implements MigrationInterface {
  name = 'RemoveWhatsappFromSocialNetworks1789500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE vendedores
      SET redes_sociales = COALESCE(
        (
          SELECT jsonb_agg(red)
          FROM jsonb_array_elements(redes_sociales) AS red
          WHERE red->>'tipo' <> 'whatsapp'
        ),
        '[]'::jsonb
      )
      WHERE redes_sociales @> '[{"tipo":"whatsapp"}]'::jsonb
    `);
  }

  async down(): Promise<void> {
    // Los enlaces históricos de WhatsApp se eliminan deliberadamente; ahora se generan desde el número verificado.
  }
}
