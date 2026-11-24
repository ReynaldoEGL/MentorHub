import { pool } from '../db/pool.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertRoleChangeAllowed, assertAccountStatusChangeAllowed } from '../utils/adminAccountPolicy.js';

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

// No cambies roles ni desactives participantes mientras tengan tutorías futuras.
// Esto evita que una asignación válida deje de poder consultarse por sus participantes.
async function assertNoActiveResponsibilities(client, userId) {
  const { rows } = await client.query(
    `SELECT
       EXISTS (SELECT 1 FROM appointments WHERE (mentor_id = $1 OR mentee_id = $1)
         AND status IN ('solicitada', 'confirmada') AND end_at >= NOW()) AS appointments,
       EXISTS (SELECT 1 FROM tutoring_offerings WHERE mentor_id = $1
         AND status = 'abierta' AND start_at >= NOW()
         AND NOT EXISTS (SELECT 1 FROM appointments WHERE offering_id = tutoring_offerings.id)) AS offers`,
    [userId],
  );
  if (rows[0].appointments || rows[0].offers) {
    throw new HttpError(409, 'Primero cancela o concluye las tutorías futuras y las ofertas sin asignar de esta cuenta.');
  }
}

export const changeUserRole = asyncHandler(async (req, res) => {
  const role = String(req.body?.role || '');
  if (!['admin', 'mentor', 'mentorado'].includes(role)) throw new HttpError(400, 'El rol indicado no es válido.');
  const client = await pool.connect();
  let user;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT id, full_name, email, role, is_active FROM users WHERE id = $1 FOR UPDATE',
      [req.params.id],
    );
    const current = rows[0];
    if (!current) throw new HttpError(404, 'Usuario no encontrado.');
    assertRoleChangeAllowed(req.user, current, role);
    if (current.role === role) {
      user = current;
    } else {
      await assertNoActiveResponsibilities(client, current.id);
      const result = await client.query(
        `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2
         RETURNING id, full_name, email, role, is_active`,
        [role, current.id],
      );
      user = result.rows[0];
      if (role === 'mentor') {
        await client.query('INSERT INTO mentor_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [current.id]);
      }
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  res.json({ user });
});

export const setUserActive = asyncHandler(async (req, res) => {
  if (typeof req.body?.is_active !== 'boolean') throw new HttpError(400, 'El estado activo debe ser verdadero o falso.');
  const client = await pool.connect();
  let user;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT id, full_name, email, role, is_active FROM users WHERE id = $1 FOR UPDATE',
      [req.params.id],
    );
    const current = rows[0];
    if (!current) throw new HttpError(404, 'Usuario no encontrado.');
    assertAccountStatusChangeAllowed(req.user, current, req.body.is_active);
    if (current.is_active === req.body.is_active) {
      user = current;
    } else {
      if (current.is_active) await assertNoActiveResponsibilities(client, current.id);
      const result = await client.query(
        `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2
         RETURNING id, full_name, email, role, is_active`,
        [req.body.is_active, current.id],
      );
      user = result.rows[0];
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  res.json({ user });
});
