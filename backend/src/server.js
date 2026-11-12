import app from './app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';

try {
  await pool.query('SELECT 1');
  const server = app.listen(env.port, () => console.log(`MentorHub API escuchando en el puerto ${env.port}`));

  const shutdown = async () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} catch (error) {
  console.error('No fue posible iniciar la API:', error.message);
  process.exit(1);
}
