'use strict';

function requireVariables(names) {
  const missing = names.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
  }

  const port = Number(process.env.DB_PORT ?? 5433);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT debe ser un puerto valido');
  }
}

function validateUrl(name) {
  if (!process.env[name]) return;
  try {
    new URL(process.env[name]);
  } catch {
    throw new Error(`${name} debe ser una URL valida`);
  }
}

module.exports = { requireVariables, validateUrl };
