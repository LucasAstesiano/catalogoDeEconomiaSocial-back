import type { MigrationInterface, QueryRunner } from 'typeorm';
export class AddRedesSociales1789100000000 implements MigrationInterface {
  name = 'AddRedesSociales1789100000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE vendedores ADD COLUMN redes_sociales jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE vendedores DROP COLUMN redes_sociales',
    );
  }
}
