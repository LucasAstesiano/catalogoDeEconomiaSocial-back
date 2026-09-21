import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEsMonotributista1789400000000 implements MigrationInterface {
  name = 'AddEsMonotributista1789400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE vendedores ADD COLUMN es_monotributista boolean NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE vendedores DROP COLUMN es_monotributista',
    );
  }
}
