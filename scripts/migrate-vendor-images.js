#!/usr/bin/env node

require('dotenv').config();
const { Client } = require('pg');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');

const APPLY = process.argv.includes('--apply');
const after = Number(process.env.VENDOR_AFTER_ID ?? 0);
const limit = Number(process.env.VENDOR_BATCH_SIZE ?? 20);
const sourceBase = 'https://www.mendoza.gov.ar/catalogoeconomiasocial';
const extensions = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/<[^>]*>/g, ' ').replace(/&(?:[a-z]+|#\d+);/gi, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (value) => new Set(normalize(value).split(' ').filter((word) => word.length > 3));
const overlap = (a, b) => { const A = tokens(a), B = tokens(b); const common = [...A].filter((word) => B.has(word)).length; return A.size && B.size ? (2 * common) / (A.size + B.size) : 0; };
const similarity = (a, b) => {
  const A = normalize(a), B = normalize(b);
  const words = A.split(' ').filter(Boolean);
  if (A && B && words.length >= 2 && (A.includes(B) || B.includes(A))) return 1;
  return overlap(a, b);
};
const imageUrl = (key) => `${process.env.PUBLIC_API_URL.replace(/\/$/, '')}/api/v1/uploads/image?key=${encodeURIComponent(key)}`;
const secret = (name) => readFileSync(`/run/secrets/${name}`, 'utf8').trim();

async function fetchJson(url) { const response = await fetch(url); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
async function vendorUrls(vendor) {
  const search = async (query) => {
    const response = await fetch(`${sourceBase}/buscar-emprendedor/`, {
      method: 'POST',
      headers: { Accept: 'text/html', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ buscar: query, depto: '' }).toString(),
    });
    if (!response.ok) throw new Error(`${response.status} búsqueda ${query}`);
    const html = await response.text();
    return [...html.matchAll(/https?:\/\/www\.mendoza\.gov\.ar\/catalogoeconomiasocial\/vendor\/([^/?"']+)\/?/g)].map((match) => `${sourceBase}/vendor/${match[1]}/`);
  };
  const exact = await search(vendor);
  if (exact.length) return [...new Set(exact)];
  const normalized = normalize(vendor);
  const words = normalized.split(' ').filter((word) => word.length >= 3);
  const variants = new Set([
    vendor.replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1 $2'),
    words.slice(0, 2).join(' '),
    words[0]?.slice(0, Math.min(words[0].length, 4)),
  ]);
  const matches = [];
  for (const query of variants) if (query && query !== vendor) matches.push(...await search(query));
  return [...new Set(matches)];
}
async function oldProducts(vendor) {
  const urls = await vendorUrls(vendor);
  const slugs = new Set();
  for (const url of urls) {
    const html = await (await fetch(url)).text();
    const pages = Math.max(1, ...[...html.matchAll(/\/page\/(\d+)\//g)].map((match) => Number(match[1])));
    for (let page = 1; page <= pages; page += 1) {
      const content = page === 1 ? html : await (await fetch(`${url}page/${page}/`)).text();
      for (const match of content.matchAll(/\/producto\/([^/?"']+)/g)) slugs.add(match[1]);
    }
  }
  const items = await Promise.all([...slugs].map(async (slug) => {
    try { return (await fetchJson(`${sourceBase}/wp-json/wp/v2/product?slug=${encodeURIComponent(slug)}&_embed=1`))[0]; } catch { return null; }
  }));
  return [...new Map(items.filter(Boolean).map((item) => [item.id, item])).values()];
}

(async () => {
  const db = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD ?? secret('db_password'), database: process.env.DB_NAME });
  await db.connect();
  const vendors = (await db.query(`SELECT DISTINCT v.id, v.nombre FROM vendedores v JOIN productos p ON p.vendedor_id=v.id WHERE v.id>$1 AND (p.imagen_url IS NULL OR btrim(p.imagen_url)='' OR p.imagen_url LIKE '%drive.google%') ORDER BY v.id LIMIT $2`, [after, limit])).rows;
  const storage = APPLY ? new S3Client({ region: process.env.S3_REGION ?? 'us-east-1', endpoint: process.env.S3_ENDPOINT, forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID ?? secret('s3_access_key_id'), secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? secret('s3_secret_access_key') } }) : null;
  let matched = 0, updated = 0;
  for (const vendor of vendors) {
    const current = (await db.query(`SELECT id,nombre,descripcion FROM productos WHERE vendedor_id=$1 AND (imagen_url IS NULL OR btrim(imagen_url)='' OR imagen_url LIKE '%drive.google%')`, [vendor.id])).rows;
    let source = [];
    try { source = await oldProducts(vendor.nombre); } catch (error) { console.log(`Vendedor ${vendor.id}: página anterior no disponible (${error.message})`); continue; }
    for (const product of current) {
      const candidates = source.map((item) => {
        const title = similarity(product.nombre, item.title?.rendered);
        const description = similarity(product.descripcion, item.excerpt?.rendered);
        return { item, score: title >= .9 ? Math.max(.7 + .3 * description, .45 * title + .55 * description) : .45 * title + .55 * description };
      }).filter(({ item }) => item._embedded?.['wp:featuredmedia']?.[0]?.source_url).sort((a, b) => b.score - a.score);
      if (!candidates[0] || candidates[0].score < .7 || (candidates[1] && candidates[0].score - candidates[1].score < .05)) continue;
      matched += 1;
      const sourceUrl = candidates[0].item._embedded['wp:featuredmedia'][0].source_url;
      console.log(`${vendor.id}|${product.id}|${candidates[0].score.toFixed(2)}|${sourceUrl}`);
      if (!APPLY) continue;
      const response = await fetch(sourceUrl); const bytes = Buffer.from(await response.arrayBuffer());
      const ext = (new URL(sourceUrl).pathname.match(/\.(jpg|jpeg|png|webp|gif)$/i) ?? [])[0]?.toLowerCase();
      if (!response.ok || !ext) continue;
      const key = `productos/vendedor-api/${product.id}/inicial-${createHash('sha256').update(bytes).digest('hex').slice(0, 16)}${ext}`;
      await storage.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: bytes, ContentType: extensions[ext], CacheControl: 'public, max-age=31536000, immutable' }));
      await db.query('UPDATE productos SET imagen_url=$1 WHERE id=$2', [imageUrl(key), product.id]); updated += 1;
    }
  }
  await db.end();
  console.log(JSON.stringify({ vendors: vendors.length, after: vendors.at(-1)?.id ?? after, matched, updated, apply: APPLY }));
})().catch((error) => { console.error(error.message); process.exit(1); });
