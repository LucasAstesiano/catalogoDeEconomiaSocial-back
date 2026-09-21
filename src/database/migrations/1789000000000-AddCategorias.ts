import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategorias1789000000000 implements MigrationInterface {
  name = 'AddCategorias1789000000000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE categorias (id SERIAL PRIMARY KEY, nombre varchar(80) NOT NULL UNIQUE, activa boolean NOT NULL DEFAULT true)`,
    );
    await queryRunner.query(
      `INSERT INTO categorias (nombre) SELECT DISTINCT categoria FROM productos WHERE categoria <> '' ON CONFLICT (nombre) DO NOTHING`,
    );
    await queryRunner.query(
      `ALTER TABLE productos ADD COLUMN categoria_id integer`,
    );
    await queryRunner.query(
      `UPDATE productos p SET categoria_id = c.id FROM categorias c WHERE c.nombre = p.categoria`,
    );
    await queryRunner.query(
      `ALTER TABLE productos ADD CONSTRAINT productos_categoria_id_fk FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `CREATE INDEX productos_categoria_id_idx ON productos(categoria_id)`,
    );
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE productos DROP CONSTRAINT productos_categoria_id_fk`,
    );
    await queryRunner.query(`DROP INDEX productos_categoria_id_idx`);
    await queryRunner.query(`ALTER TABLE productos DROP COLUMN categoria_id`);
    await queryRunner.query(`DROP TABLE categorias`);
  }
}
