import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'node:crypto';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendEmail } from '../services/email.js';

const publicUser = (user) => ({
  id: user.id,
  full_name: user.full_name,
  email: user.email,
  role: user.role,
});

function issueToken(user) {
  return jwt.sign({ role: user.role }, env.jwtSecret, {
    subject: user.id,
    expiresIn: env.jwtExpiresIn,
  });
}

export const register = asyncHandler(async (req, res) => {
  const fullName = String(req.body.full_name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (fullName.length < 3 || fullName.length > 140) throw new HttpError(400, 'El nombre debe tener entre 3 y 140 caracteres.');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Ingresa un correo válido.');
  if (password.length < 8) throw new HttpError(400, 'La contraseña debe tener al menos 8 caracteres.');
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, 'mentorado')
       RETURNING id, full_name, email, role`,
      [fullName, email, passwordHash],
    );
    const user = rows[0];
    res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    if (error.code === '23505') throw new HttpError(409, 'Ya existe una cuenta con ese correo.');
    throw error;
  }
});

export const login = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const { rows } = await pool.query(
    'SELECT id, full_name, email, password_hash, role, is_active FROM users WHERE email = $1',
    [email],
  );
  const user = rows[0];
  if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
    throw new HttpError(401, 'Correo o contraseña incorrectos.');
  }
  res.json({ token: issueToken(user), user: publicUser(user) });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const { rows } = await pool.query('SELECT id, email FROM users WHERE email = $1 AND is_active = TRUE', [email]);
  // Respuesta genérica para no revelar si un correo está registrado.
  if (rows[0]) {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await pool.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
      [rows[0].id, tokenHash],
    );
    const frontendUrl = env.frontendUrls[0];
    await sendEmail({
      to: rows[0].email,
      subject: 'Recuperación de contraseña - MentorHub',
      text: `Se solicitó restablecer tu contraseña. Abre este enlace dentro de los próximos 30 minutos: ${frontendUrl}/restablecer?token=${rawToken}`,
    });
  }
  res.json({ message: 'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const token = String(req.body.token || '');
  const password = String(req.body.password || '');
  if (token.length < 32 || password.length < 8) throw new HttpError(400, 'El token o la contraseña no cumplen los requisitos.');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, user_id FROM password_resets
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [tokenHash],
    );
    if (!rows[0]) throw new HttpError(400, 'El enlace de recuperación expiró o ya fue utilizado.');
    const passwordHash = await bcrypt.hash(password, 12);
    await client.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, rows[0].user_id]);
    await client.query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [rows[0].id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.json({ message: 'La contraseña fue actualizada. Ya puedes iniciar sesión.' });
});
