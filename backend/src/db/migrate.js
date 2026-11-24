import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { pool } from './pool.js';

const here = dirname(fileURLToPath(import.meta.url));
try {
  const migrationsPath = resolve(here, '../../migrations');
  const filenames = (await readdir(migrationsPath)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
  for (const filename of filenames) {
    // Las migraciones incluyen IF NOT EXISTS / IF NOT EXISTS ADD COLUMN y son idempotentes.
    const sql = await readFile(resolve(migrationsPath, filename), 'utf8');
    await pool.query(sql);
    console.log(`Migración ${filename} comprobada.`);
  }
} catch (error) {
  console.error('No fue posible ejecutar las migraciones:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
