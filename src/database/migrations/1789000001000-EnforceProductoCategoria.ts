import type { MigrationInterface, QueryRunner } from 'typeorm';

export class EnforceProductoCategoria1789000001000 implements MigrationInterface {
  name = 'EnforceProductoCategoria1789000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      'SELECT COUNT(*)::text AS total FROM productos WHERE categoria_id IS NULL',
    )) as Array<{ total: string }>;
    const [{ total }] = rows;
    if (Number(total) > 0) {
      throw new Error(
        'No se puede exigir categoría: existen productos sin categoria_id.',
      );
    }
    await queryRunner.query(
      'ALTER TABLE productos ALTER COLUMN categoria_id SET NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE productos ALTER COLUMN categoria_id DROP NOT NULL',
    );
  }
}
