import { pool } from '../db/pool.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listMentors = asyncHandler(async (req, res) => {
  const search = `%${String(req.query.search || '').trim()}%`;
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, mp.areas, mp.description
     FROM users u INNER JOIN mentor_profiles mp ON mp.user_id = u.id
     WHERE u.role = 'mentor' AND u.is_active = TRUE
       AND (u.full_name ILIKE $1 OR mp.description ILIKE $1 OR array_to_string(mp.areas, ',') ILIKE $1)
     ORDER BY u.full_name`,
    [search],
  );
  res.json({ mentors: rows });
});

export const getMentor = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, mp.areas, mp.description
     FROM users u INNER JOIN mentor_profiles mp ON mp.user_id = u.id
     WHERE u.id = $1 AND u.role = 'mentor' AND u.is_active = TRUE`,
    [req.params.id],
  );
  if (!rows[0]) throw new HttpError(404, 'Mentor no encontrado.');
  res.json({ mentor: rows[0] });
});

export const updateMentorProfile = asyncHandler(async (req, res) => {
  const areas = Array.isArray(req.body.areas)
    ? req.body.areas.map((area) => String(area).trim()).filter(Boolean).slice(0, 20)
    : String(req.body.areas || '').split(',').map((area) => area.trim()).filter(Boolean).slice(0, 20);
  const description = String(req.body.description || '').trim().slice(0, 1500);
  const { rows } = await pool.query(
    `INSERT INTO mentor_profiles (user_id, areas, description, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id) DO UPDATE SET areas = EXCLUDED.areas,
       description = EXCLUDED.description, updated_at = NOW()
     RETURNING user_id, areas, description`,
    [req.user.id, areas, description],
  );
  res.json({ profile: rows[0] });
});
