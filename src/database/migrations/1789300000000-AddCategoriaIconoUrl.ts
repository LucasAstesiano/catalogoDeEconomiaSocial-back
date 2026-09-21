import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategoriaIconoUrl1789300000000 implements MigrationInterface {
  name = 'AddCategoriaIconoUrl1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE categorias ADD COLUMN icono_url varchar(2048)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE categorias DROP COLUMN icono_url`);
  }
}
