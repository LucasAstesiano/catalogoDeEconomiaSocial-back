import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminEmailMfa1787878800000 implements MigrationInterface {
  name = 'AddAdminEmailMfa1787878800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE vendedores
        ADD COLUMN IF NOT EXISTS admin_mfa_challenge_id uuid,
        ADD COLUMN IF NOT EXISTS admin_mfa_code_hash varchar(64),
        ADD COLUMN IF NOT EXISTS admin_mfa_expires_at timestamptz,
        ADD COLUMN IF NOT EXISTS admin_mfa_attempts smallint NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_vendedores_admin_mfa_challenge
      ON vendedores (admin_mfa_challenge_id)
      WHERE admin_mfa_challenge_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_vendedores_admin_mfa_challenge',
    );
    await queryRunner.query(`
      ALTER TABLE vendedores
        DROP COLUMN IF EXISTS admin_mfa_attempts,
        DROP COLUMN IF EXISTS admin_mfa_expires_at,
        DROP COLUMN IF EXISTS admin_mfa_code_hash,
        DROP COLUMN IF EXISTS admin_mfa_challenge_id
    `);
  }
}
