import type { MigrationInterface, QueryRunner } from 'typeorm';

export class EnforceUniquePendingRegistrationEmail1787792400000 implements MigrationInterface {
  name = 'EnforceUniquePendingRegistrationEmail1787792400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE solicitudes
      SET solicitante_email = lower(trim(payload->>'email'))
      WHERE tipo = 'registro_usuario'
        AND payload ? 'email'
    `);
    await queryRunner.query(`
      WITH duplicadas AS (
        SELECT id,
               row_number() OVER (
                 PARTITION BY lower(trim(payload->>'email'))
                 ORDER BY created_at, id
               ) AS posicion
        FROM solicitudes
        WHERE tipo = 'registro_usuario'
          AND estado = 'pendiente'
          AND nullif(trim(payload->>'email'), '') IS NOT NULL
      )
      UPDATE solicitudes AS solicitud
      SET estado = 'rechazada',
          resolved_at = now(),
          updated_at = now()
      FROM duplicadas
      WHERE solicitud.id = duplicadas.id
        AND duplicadas.posicion > 1
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS solicitudes_registro_pendiente_email_uq
      ON solicitudes ((lower(trim(payload->>'email'))))
      WHERE tipo = 'registro_usuario' AND estado = 'pendiente'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS solicitudes_registro_pendiente_email_uq',
    );
  }
}
