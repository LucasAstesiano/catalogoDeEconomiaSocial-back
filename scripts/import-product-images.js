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
const REPLACE_LEGACY = process.argv.includes('--replace-legacy');
const MATCH_VENDOR = process.argv.includes('--match-vendor');
const MATCH_PRODUCT_DESCRIPTION = process.argv.includes('--match-product-description');
const PRIMARY_SUFFIX = (process.env.IMAGE_PRIMARY_SUFFIX ?? 'F').toUpperCase();
const SECONDARY_SUFFIX = (process.env.IMAGE_SECONDARY_SUFFIX ?? 'I').toUpperCase();
const imagesDirectory = path.resolve(
  __dirname,
  process.env.PRODUCT_IMAGES_DIR ?? '../../../datos/imagenes1',
);

const supportedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
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

function parseImage(filename) {
  const extension = path.extname(filename).toLowerCase();
  if (!supportedExtensions.has(extension)) return null;

  const match = path.basename(filename, extension).match(/^(.*)_([A-Z])$/i);
  if (!match) return null;
  const suffix = match[2].toUpperCase();
  if (suffix !== PRIMARY_SUFFIX && suffix !== SECONDARY_SUFFIX) return null;

  return {
    filename,
    extension,
    label: match[1],
    normalizedLabel: normalize(match[1]),
    slot: suffix === PRIMARY_SUFFIX ? 'imagen_url' : 'imagen_url_2',
  };
}

function resolveProduct(image, products) {
  if (MATCH_PRODUCT_DESCRIPTION) {
    const matches = products.filter(
      (product) =>
        normalize(`${product.producto}-${product.descripcion}`) === image.normalizedLabel,
    );
    if (matches.length === 1) {
      return { product: matches[0], method: 'producto y descripción' };
    }
    return {
      candidates: matches,
      reason: matches.length
        ? `producto y descripción ambiguos (${matches.length} coincidencias)`
        : 'sin producto y descripción coincidentes',
    };
  }

  if (MATCH_VENDOR) {
    const vendorMatches = products.filter(
      (product) =>
        normalize(`${product.vendedor}-${product.vendedor}`) === image.normalizedLabel,
    );
    const productsById = Array.from(
      new Map(vendorMatches.map((product) => [product.id, product])).values(),
    );

    if (productsById.length === 1) {
      return { product: productsById[0], method: 'vendedor con producto único' };
    }
    return {
      candidates: productsById,
      reason: productsById.length
        ? `el vendedor tiene ${productsById.length} productos`
        : 'sin vendedor coincidente',
    };
  }

  const pairMatches = products.filter(
    (product) =>
      normalize(`${product.vendedor}-${product.producto}`) === image.normalizedLabel,
  );
  if (pairMatches.length === 1) return { product: pairMatches[0], method: 'par' };

  const suffixMatches = products.filter((product) =>
    image.normalizedLabel.endsWith(normalize(product.producto)),
  );
  if (!suffixMatches.length) return { candidates: [], reason: 'sin producto coincidente' };

  const longestName = Math.max(
    ...suffixMatches.map((product) => normalize(product.producto).length),
  );
  const longestMatches = suffixMatches.filter(
    (product) => normalize(product.producto).length === longestName,
  );

  if (longestMatches.length === 1) {
    return { product: longestMatches[0], method: 'nombre de producto' };
  }

  return {
    candidates: longestMatches,
    reason: `nombre ambiguo (${longestMatches.length} productos)`,
  };
}

function publicUrl(key) {
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
      SELECT p.id, p.nombre AS producto, p.descripcion, p.imagen_url, p.imagen_url_2,
             v.id AS vendedor_id, v.nombre AS vendedor
      FROM productos p
      JOIN vendedores v ON v.id = p.vendedor_id
      ORDER BY p.id
    `);
    const products = result.rows;
    const files = (await readdir(imagesDirectory)).sort((a, b) =>
      a.localeCompare(b, 'es'),
    );
    const invalid = [];
    const unresolved = [];
    const assignments = [];
    const occupied = new Map();

    for (const filename of files) {
      const image = parseImage(filename);
      if (!image) {
        invalid.push(filename);
        continue;
      }
      const resolution = resolveProduct(image, products);
      if (!resolution.product) {
        unresolved.push({ image, ...resolution });
        continue;
      }

      const assignmentKey = `${resolution.product.id}:${image.slot}`;
      if (occupied.has(assignmentKey)) {
        unresolved.push({
          image,
          candidates: [resolution.product],
          reason: `colisión con ${occupied.get(assignmentKey)}`,
        });
        continue;
      }
      occupied.set(assignmentKey, filename);
      assignments.push({ image, ...resolution });
    }

    const shouldImport = ({ image, product }) => {
      const currentUrl = product[image.slot];
      if (!currentUrl || currentUrl.includes('drive.google.com') || REPLACE) return true;
      return REPLACE_LEGACY && !currentUrl.includes('/uploads/image?key=productos');
    };
    const skippedExisting = assignments.filter((assignment) => !shouldImport(assignment));
    const pending = assignments.filter(shouldImport);

    console.log(`Directorio: ${imagesDirectory}`);
    console.log(`Archivos encontrados: ${files.length}`);
    console.log(`Asignaciones seguras: ${assignments.length}`);
    console.log(`Pendientes de importar: ${pending.length}`);
    console.log(`Ya vinculadas (omitidas): ${skippedExisting.length}`);
    console.log(`No resueltas: ${unresolved.length}`);
    console.log(`Formato inválido: ${invalid.length}`);

    if (unresolved.length) {
      console.log('\nImágenes no resueltas:');
      for (const item of unresolved) {
        const ids = item.candidates?.map(({ id }) => id).join(', ') || '-';
        console.log(`- ${item.image.filename}: ${item.reason}; IDs: ${ids}`);
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
      for (const [index, assignment] of pending.entries()) {
        const { image, product } = assignment;
        const bytes = await readFile(path.join(imagesDirectory, image.filename));
        const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
        const position = image.slot === 'imagen_url' ? 'inicial' : 'final';
        const key = `productos/importados/${product.id}/${position}-${digest}${image.extension}`;

        await storage.send(
          new PutObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: key,
            Body: bytes,
            ContentType: contentTypes[image.extension],
            CacheControl: 'public, max-age=31536000, immutable',
          }),
        );
        await database.query(`UPDATE productos SET ${image.slot} = $1 WHERE id = $2`, [
          publicUrl(key),
          product.id,
        ]);
        console.log(`[${index + 1}/${pending.length}] ${image.filename} -> producto ${product.id}`);
      }
      await database.query('COMMIT');
    } catch (error) {
      await database.query('ROLLBACK');
      throw error;
    }
    console.log(`\nImportación completa: ${pending.length} imágenes vinculadas.`);
  } finally {
    await database.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
