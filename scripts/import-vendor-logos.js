#!/usr/bin/env node

require('dotenv').config();
const { requireVariables, validateUrl } = require('./validate-env');

const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { Client } = require('pg');
const { createHash } = require('node:crypto');
const { readFile, readdir } = require('node:fs/promises');
const path = require('node:path');

const APPLY = process.argv.includes('--apply');
requireVariables(['DB_PASSWORD']);
if (APPLY) requireVariables(['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']);
validateUrl('PUBLIC_API_URL');
validateUrl('S3_ENDPOINT');
const REPLACE = process.argv.includes('--replace');
const logosDirectory = path.resolve(
  __dirname,
  process.env.VENDOR_LOGOS_DIR ?? '../../../datos/logos',
);
const contentTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

function normalize(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9]+/g, '');
}

function identities(vendor) {
  const values = [{ value: vendor.nombre, source: 'emprendimiento' }];
  for (const group of vendor.integrantes_equipo ?? []) {
    values.push({ value: group, source: 'integrante' });
    for (const person of group.split(/\s+(?:y|e|and)\s+|[,;&/]+/i)) {
      values.push({ value: person, source: 'integrante' });
    }
  }
  return Array.from(
    new Map(
      values
        .map((item) => ({ ...item, normalized: normalize(item.value) }))
        .filter((item) => item.normalized.length >= 4)
        .map((item) => [item.normalized, item]),
    ).values(),
  );
}

function resolveVendor(filename, vendors) {
  const label = normalize(path.basename(filename, path.extname(filename)));
  const matches = [];

  for (const vendor of vendors) {
    const matchingIdentities = identities(vendor).filter(
      ({ normalized }) => label.includes(normalized) || normalized.includes(label),
    );
    if (!matchingIdentities.length) continue;
    const best = matchingIdentities.sort(
      (a, b) => b.normalized.length - a.normalized.length,
    )[0];
    matches.push({ vendor, identity: best, score: best.normalized.length });
  }

  if (!matches.length) return { reason: 'sin coincidencia', candidates: [] };
  const bestScore = Math.max(...matches.map(({ score }) => score));
  const bestMatches = matches.filter(({ score }) => score === bestScore);
  if (bestMatches.length !== 1) {
    return {
      reason: `coincidencia ambigua (${bestMatches.length} vendedores)`,
      candidates: bestMatches,
    };
  }
  return bestMatches[0];
}

function deliveryUrl(key) {
  const apiBase = (process.env.PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
  return `${apiBase}/api/v1/uploads/image?key=${encodeURIComponent(key)}`;
}

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
    const result = await database.query(`
      SELECT id, nombre, integrantes_equipo, logo_url
      FROM vendedores
      ORDER BY id
    `);
    const vendors = result.rows;
    const files = (await readdir(logosDirectory)).sort((a, b) =>
      a.localeCompare(b, 'es'),
    );
    const invalid = [];
    const unresolved = [];
    const resolved = [];
    const occupied = new Map();

    for (const filename of files) {
      const extension = path.extname(filename).toLowerCase();
      if (!contentTypes[extension]) {
        invalid.push(filename);
        continue;
      }
      const resolution = resolveVendor(filename, vendors);
      if (!resolution.vendor) {
        unresolved.push({ filename, ...resolution });
        continue;
      }
      if (occupied.has(resolution.vendor.id)) {
        unresolved.push({
          filename,
          reason: `colisión con ${occupied.get(resolution.vendor.id)}`,
          candidates: [resolution],
        });
        continue;
      }
      occupied.set(resolution.vendor.id, filename);
      resolved.push({ filename, extension, ...resolution });
    }

    const pending = resolved.filter(({ vendor }) => !vendor.logo_url || REPLACE);
    const skipped = resolved.filter(({ vendor }) => vendor.logo_url && !REPLACE);

    console.log(`Directorio: ${logosDirectory}`);
    console.log(`Archivos encontrados: ${files.length}`);
    console.log(`Asociaciones seguras: ${resolved.length}`);
    console.log(`Pendientes de importar: ${pending.length}`);
    console.log(`Logos existentes (omitidos): ${skipped.length}`);
    console.log(`No resueltos: ${unresolved.length}`);
    console.log(`Formato inválido: ${invalid.length}`);

    if (unresolved.length) {
      console.log('\nLogos no resueltos:');
      for (const item of unresolved) {
        const candidates = item.candidates
          ?.map(({ vendor }) => `${vendor.id}:${vendor.nombre}`)
          .join(', ');
        console.log(`- ${item.filename}: ${item.reason}; candidatos: ${candidates || '-'}`);
      }
    }
    if (invalid.length) {
      console.log('\nArchivos con formato inválido:');
      invalid.forEach((filename) => console.log(`- ${filename}`));
    }
    if (!APPLY) {
      console.log('\nSimulación terminada. Use --apply para subir y vincular.');
      return;
    }
    if (!process.env.S3_BUCKET) throw new Error('Falta configurar S3_BUCKET.');

    const storage = new S3Client({
      region: process.env.S3_REGION ?? 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials:
        process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
            }
          : undefined,
    });

    await database.query('BEGIN');
    try {
      for (const [index, item] of pending.entries()) {
        const bytes = await readFile(path.join(logosDirectory, item.filename));
        const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
        const key = `vendedores/importados/${item.vendor.id}/logo-${digest}${item.extension}`;
        await storage.send(
          new PutObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: key,
            Body: bytes,
            ContentType: contentTypes[item.extension],
            CacheControl: 'public, max-age=31536000, immutable',
          }),
        );
        await database.query('UPDATE vendedores SET logo_url = $1 WHERE id = $2', [
          deliveryUrl(key),
          item.vendor.id,
        ]);
        console.log(
          `[${index + 1}/${pending.length}] ${item.filename} -> vendedor ${item.vendor.id} (${item.vendor.nombre})`,
        );
      }
      await database.query('COMMIT');
    } catch (error) {
      await database.query('ROLLBACK');
      throw error;
    }
    console.log(`\nImportación completa: ${pending.length} logos vinculados.`);
  } finally {
    await database.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
