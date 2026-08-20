#!/usr/bin/env node

require('dotenv').config();
const { requireVariables } = require('./validate-env');
requireVariables(['DB_PASSWORD']);
const argon2 = require('argon2');
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');

async function main() {
  const database = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5433),
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME ?? 'db-catalogo',
  });
  await database.connect();

  try {
    const duplicates = await database.query(`
      SELECT lower(trim(email)) AS normalized_email, count(*)::int AS amount
      FROM vendedores
      GROUP BY lower(trim(email))
      HAVING count(*) > 1
    `);
    if (duplicates.rowCount) {
      throw new Error(
        `Hay emails duplicados por mayusculas/minusculas: ${duplicates.rows
          .map((row) => `${row.normalized_email} (${row.amount})`)
          .join(', ')}`,
      );
    }

    const pending = await database.query(`
      SELECT id, payload
      FROM solicitudes
      WHERE tipo = 'registro_usuario'
        AND estado = 'pendiente'
        AND payload ? 'password'
    `);
    const legacyUsers = await database.query(`
      SELECT count(*)::int AS amount
      FROM vendedores
      WHERE password_hash NOT LIKE '$argon2%'
    `);

    console.log(`Emails a normalizar: verificados sin duplicados.`);
    console.log(`Solicitudes con password en claro: ${pending.rowCount}.`);
    console.log(
      `Usuarios con hash legado (cambio obligatorio al ingresar): ${legacyUsers.rows[0].amount}.`,
    );

    if (!APPLY) {
      console.log(
        'Simulacion terminada. Usa --apply para ejecutar la migracion.',
      );
      return;
    }

    await database.query('BEGIN');
    try {
      await database.query('UPDATE vendedores SET email = lower(trim(email))');
      for (const row of pending.rows) {
        const { password, ...safePayload } = row.payload;
        safePayload.passwordHash = await argon2.hash(String(password ?? ''), {
          type: argon2.argon2id,
          memoryCost: 19_456,
          timeCost: 2,
          parallelism: 1,
        });
        await database.query(
          'UPDATE solicitudes SET payload = $1 WHERE id = $2',
          [safePayload, row.id],
        );
      }
      await database.query('COMMIT');
    } catch (error) {
      await database.query('ROLLBACK');
      throw error;
    }
    console.log('Migracion de seguridad completada.');
  } finally {
    await database.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
