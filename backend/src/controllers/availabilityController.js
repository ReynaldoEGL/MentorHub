import { pool } from '../db/pool.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function validTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
}

export const listMyAvailability = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, weekday, specific_date, to_char(start_time, 'HH24:MI') AS start_time,
            to_char(end_time, 'HH24:MI') AS end_time, active_from, active_until
     FROM availabilities WHERE mentor_id = $1
     ORDER BY specific_date NULLS LAST, weekday, start_time`,
    [req.user.id],
  );
  res.json({ availabilities: rows });
});

export const listMentorAvailability = asyncHandler(async (req, res) => {
  const mentor = await pool.query("SELECT id FROM users WHERE id = $1 AND role = 'mentor' AND is_active = TRUE", [req.params.mentorId]);
  if (!mentor.rows[0]) throw new HttpError(404, 'Mentor no encontrado.');
  const { rows } = await pool.query(
    `SELECT id, weekday, specific_date, to_char(start_time, 'HH24:MI') AS start_time,
            to_char(end_time, 'HH24:MI') AS end_time, active_from, active_until
     FROM availabilities WHERE mentor_id = $1
     ORDER BY specific_date NULLS LAST, weekday, start_time`,
    [req.params.mentorId],
  );
  res.json({ availabilities: rows });
});

export const createAvailability = asyncHandler(async (req, res) => {
  const { weekday, specific_date: specificDate, start_time: startTime, end_time: endTime, active_from: activeFrom, active_until: activeUntil } = req.body;
  const hasWeekday = weekday !== undefined && weekday !== null && weekday !== '';
  const hasDate = Boolean(specificDate);
  if (hasWeekday === hasDate) throw new HttpError(400, 'Selecciona un día recurrente o una fecha específica, no ambos.');
  if (hasWeekday && (!Number.isInteger(Number(weekday)) || Number(weekday) < 0 || Number(weekday) > 6)) {
    throw new HttpError(400, 'El día de la semana no es válido.');
  }
  if (hasDate && !/^\d{4}-\d{2}-\d{2}$/.test(specificDate)) throw new HttpError(400, 'La fecha específica no es válida.');
  if (!validTime(startTime) || !validTime(endTime) || startTime >= endTime) throw new HttpError(400, 'El horario debe tener inicio y fin válidos.');
  if (activeFrom && !/^\d{4}-\d{2}-\d{2}$/.test(activeFrom)) throw new HttpError(400, 'La fecha de inicio de vigencia no es válida.');
  if (activeUntil && !/^\d{4}-\d{2}-\d{2}$/.test(activeUntil)) throw new HttpError(400, 'La fecha de fin de vigencia no es válida.');
  const { rows } = await pool.query(
    `INSERT INTO availabilities (mentor_id, weekday, specific_date, start_time, end_time, active_from, active_until)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, weekday, specific_date, to_char(start_time, 'HH24:MI') AS start_time,
               to_char(end_time, 'HH24:MI') AS end_time, active_from, active_until`,
    [req.user.id, hasWeekday ? Number(weekday) : null, hasDate ? specificDate : null, startTime, endTime, activeFrom || null, activeUntil || null],
  );
  res.status(201).json({ availability: rows[0] });
});

export const deleteAvailability = asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM availabilities WHERE id = $1 AND mentor_id = $2', [req.params.id, req.user.id]);
  if (!rowCount) throw new HttpError(404, 'Bloque de disponibilidad no encontrado.');
  res.json({ message: 'Disponibilidad eliminada.' });
});
