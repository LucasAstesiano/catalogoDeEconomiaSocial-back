import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTemporaryPasswordExpiration1787702400000 implements MigrationInterface {
  name = 'AddTemporaryPasswordExpiration1787702400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE vendedores
      ADD COLUMN IF NOT EXISTS temporary_password_expires_at timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE vendedores DROP COLUMN IF EXISTS temporary_password_expires_at
    `);
  }
}
