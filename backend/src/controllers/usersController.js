import { pool } from '../db/pool.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const updateOwnProfile = asyncHandler(async (req, res) => {
  const fullName = String(req.body.full_name || '').trim();
  if (fullName.length < 3 || fullName.length > 140) throw new HttpError(400, 'El nombre debe tener entre 3 y 140 caracteres.');
  const { rows } = await pool.query(
    'UPDATE users SET full_name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, full_name, email, role',
    [fullName, req.user.id],
  );
  res.json({ user: rows[0] });
});

export const listUsers = asyncHandler(async (req, res) => {
  const search = `%${String(req.query.search || '').trim()}%`;
  const { rows } = await pool.query(
    `SELECT id, full_name, email, role, is_active, created_at
     FROM users WHERE full_name ILIKE $1 OR email ILIKE $1
     ORDER BY created_at DESC LIMIT 200`,
    [search],
  );
  res.json({ users: rows });
});

export const changeUserRole = asyncHandler(async (req, res) => {
  const role = String(req.body.role || '');
  if (!['admin', 'mentor', 'mentorado'].includes(role)) throw new HttpError(400, 'El rol indicado no es válido.');
  if (req.params.id === req.user.id && role !== 'admin') throw new HttpError(400, 'No puedes retirar tu propio rol de administrador.');
  const { rows } = await pool.query(
    `UPDATE users SET role = $1, updated_at = NOW()
     WHERE id = $2 RETURNING id, full_name, email, role, is_active`,
    [role, req.params.id],
  );
  if (!rows[0]) throw new HttpError(404, 'Usuario no encontrado.');
  if (role === 'mentor') {
    await pool.query('INSERT INTO mentor_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [req.params.id]);
  }
  res.json({ user: rows[0] });
});

export const setUserActive = asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) throw new HttpError(400, 'No puedes desactivar tu propia cuenta.');
  const { rows } = await pool.query(
    'UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, full_name, email, role, is_active',
    [Boolean(req.body.is_active), req.params.id],
  );
  if (!rows[0]) throw new HttpError(404, 'Usuario no encontrado.');
  res.json({ user: rows[0] });
});
