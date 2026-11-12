import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { pool } from './pool.js';

const here = dirname(fileURLToPath(import.meta.url));
try {
  const sql = await readFile(resolve(here, '../../migrations/001_initial.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migración 001 ejecutada correctamente.');
} catch (error) {
  console.error('No fue posible ejecutar las migraciones:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
