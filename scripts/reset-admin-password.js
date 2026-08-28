#!/usr/bin/env node
'use strict';

const { readFileSync } = require('node:fs');
const { randomBytes } = require('node:crypto');
const argon2 = require('argon2');
const { Client } = require('pg');

function readSecret(name) {
  const file = process.env[`${name}_FILE`];
  if (file) return readFileSync(file, 'utf8').trim();
  return process.env[name];
}

async function main() {
  const email = String(process.argv[2] ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error(
      'Uso: npm run admin:reset-password -- administrador@ejemplo.com',
    );
  }

  const temporaryPassword = `${randomBytes(18).toString('base64url')}aA1!`;
  const passwordHash = await argon2.hash(temporaryPassword, {
    type: argon2.argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
  });
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5433),
    user: process.env.DB_USER ?? 'postgres',
    password: readSecret('DB_PASSWORD'),
    database: process.env.DB_NAME ?? 'db-catalogo',
  });

  await client.connect();
  try {
    const result = await client.query(
      `UPDATE vendedores
         SET password_hash = $1,
             session_version = session_version + 1,
             password_change_required = true,
             temporary_password_expires_at = now() + interval '30 minutes'
       WHERE lower(email) = $2 AND rol = 'administrador'
       RETURNING id, email`,
      [passwordHash, email],
    );
    if (result.rowCount !== 1) {
      throw new Error('No existe una cuenta administradora con ese email.');
    }

    process.stdout.write(
      `Contraseña temporal (se muestra una sola vez): ${temporaryPassword}\n` +
        'Vence en 30 minutos. Inicie sesión y cámbiela inmediatamente.\n',
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Error desconocido';
  process.stderr.write(`No se pudo restablecer la contraseña: ${message}\n`);
  process.exitCode = 1;
});
