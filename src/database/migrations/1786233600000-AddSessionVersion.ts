import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionVersion1786233600000 implements MigrationInterface {
  name = 'AddSessionVersion1786233600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE vendedores
      ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE vendedores DROP COLUMN IF EXISTS session_version
    `);
  }
}
