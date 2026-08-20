import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SecurityBaseline1786060800000 implements MigrationInterface {
  name = 'SecurityBaseline1786060800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vendedores (
        id SERIAL PRIMARY KEY,
        rol varchar(20) NOT NULL DEFAULT 'usuario',
        estado_solicitud varchar(20) NOT NULL DEFAULT 'aprobado',
        nombre varchar(120) NOT NULL,
        email varchar(160) NOT NULL,
        ruess varchar(30),
        descripcion_negocio text,
        integrantes_equipo text[] NOT NULL DEFAULT '{}',
        ubicacion text,
        whatsapp text,
        telefono text,
        logo_url text,
        password_hash varchar(128) NOT NULL
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS vendedores_email_lower_uq ON vendedores (lower(email))',
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS productos (
        id SERIAL PRIMARY KEY,
        nombre varchar(120) NOT NULL,
        descripcion text NOT NULL,
        categoria varchar(80) NOT NULL,
        subcategoria varchar(120),
        imagen_url text,
        imagen_url_2 text,
        imagen_url_3 text,
        imagen_url_4 text,
        vendedor_id integer NOT NULL REFERENCES vendedores(id) ON DELETE RESTRICT,
        destacado boolean NOT NULL DEFAULT false
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS solicitudes (
        id SERIAL PRIMARY KEY,
        tipo varchar(40) NOT NULL,
        estado varchar(20) NOT NULL DEFAULT 'pendiente',
        solicitante_id integer,
        solicitante_email varchar(160),
        solicitante_nombre varchar(120),
        entidad_objetivo varchar(40),
        entidad_id integer,
        payload jsonb NOT NULL,
        resuelto_por integer,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        resolved_at timestamp
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS solicitudes');
    await queryRunner.query('DROP TABLE IF EXISTS productos');
    await queryRunner.query('DROP TABLE IF EXISTS vendedores');
  }
}
