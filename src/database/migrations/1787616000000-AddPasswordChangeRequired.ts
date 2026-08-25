import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordChangeRequired1787616000000 implements MigrationInterface {
  name = 'AddPasswordChangeRequired1787616000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE vendedores
      ADD COLUMN IF NOT EXISTS password_change_required boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE vendedores DROP COLUMN IF EXISTS password_change_required
    `);
  }
}
