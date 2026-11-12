import bcrypt from 'bcryptjs';
import { pool } from '../src/db/pool.js';

const [fullName, emailRaw, password] = process.argv.slice(2);
const email = String(emailRaw || '').trim().toLowerCase();
if (!fullName || !email || !password || password.length < 8) {
  console.error('Uso: npm run seed:admin -- "Nombre Administrador" admin@dominio.com "ContraseñaSegura"');
  process.exit(1);
}
try {
  const passwordHash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO UPDATE SET role = 'admin', is_active = TRUE, updated_at = NOW()
     RETURNING id, full_name, email, role`,
    [fullName, email, passwordHash],
  );
  console.log('Administrador listo:', rows[0]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
