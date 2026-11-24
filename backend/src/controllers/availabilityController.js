import { pool } from '../db/pool.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { localParts } from '../services/scheduling.js';

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
  if (activeFrom && activeUntil && activeUntil < activeFrom) throw new HttpError(400, 'La fecha final de vigencia no puede ser anterior a la inicial.');
  const { rows } = await pool.query(
    `INSERT INTO availabilities (mentor_id, weekday, specific_date, start_time, end_time, active_from, active_until)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, weekday, specific_date, to_char(start_time, 'HH24:MI') AS start_time,
               to_char(end_time, 'HH24:MI') AS end_time, active_from, active_until`,
    [req.user.id, hasWeekday ? Number(weekday) : null, hasDate ? specificDate : null, startTime, endTime, activeFrom || null, activeUntil || null],
  );
  res.status(201).json({ availability: rows[0] });
});

// Conserva la disponibilidad que cubre tutorías publicadas o citas futuras.
// Los cambios se serializan por mentor con las operaciones de publicación/asignación.
function blockCovers(block, startAt, endAt) {
  const start = localParts(startAt);
  const end = localParts(endAt);
  if (start.date !== end.date) return false;
  const matchesDay = block.specific_date
    ? block.specific_date === start.date
    : Number(block.weekday) === start.weekday
      && (!block.active_from || block.active_from <= start.date)
      && (!block.active_until || block.active_until >= start.date);
  return matchesDay && block.start_time <= start.time && block.end_time >= end.time;
}

async function assertBlockHasNoFutureSessions(client, block) {
  const { rows } = await client.query(
    `SELECT start_at, end_at FROM tutoring_offerings
       WHERE mentor_id = $1 AND status = 'abierta' AND start_at >= NOW()
     UNION ALL
     SELECT start_at, end_at FROM appointments
       WHERE mentor_id = $1 AND status IN ('solicitada','confirmada') AND start_at >= NOW()`,
    [block.mentor_id],
  );
  if (rows.some((slot) => blockCovers(block, slot.start_at, slot.end_at))) {
    throw new HttpError(409, 'Este horario contiene tutorías pendientes o asignadas. Cancélalas desde su módulo antes de modificar el bloque.');
  }
}

async function lockAvailability(client, id, mentorId) {
  const { rows } = await client.query(
    `SELECT id, mentor_id, weekday, to_char(specific_date, 'YYYY-MM-DD') AS specific_date,
       to_char(start_time, 'HH24:MI') AS start_time, to_char(end_time, 'HH24:MI') AS end_time,
       to_char(active_from, 'YYYY-MM-DD') AS active_from,
       to_char(active_until, 'YYYY-MM-DD') AS active_until
     FROM availabilities WHERE id = $1 AND mentor_id = $2 FOR UPDATE`,
    [id, mentorId],
  );
  if (!rows[0]) throw new HttpError(404, 'Bloque de disponibilidad no encontrado.');
  return rows[0];
}

export const deleteAvailability = asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    const block = await lockAvailability(client, req.params.id, req.user.id);
    await assertBlockHasNoFutureSessions(client, block);
    await client.query('DELETE FROM availabilities WHERE id = $1', [block.id]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  res.json({ message: 'Disponibilidad eliminada.' });
});

export const updateAvailability = asyncHandler(async (req, res) => {
  const { weekday, specific_date: specificDate, start_time: startTime, end_time: endTime, active_from: activeFrom, active_until: activeUntil } = req.body;
  const hasWeekday = weekday !== undefined && weekday !== null && weekday !== '';
  const hasDate = Boolean(specificDate);
  if (hasWeekday === hasDate) throw new HttpError(400, 'Selecciona un día recurrente o una fecha específica, no ambos.');
  if (hasWeekday && (!Number.isInteger(Number(weekday)) || Number(weekday) < 0 || Number(weekday) > 6)) throw new HttpError(400, 'El día de la semana no es válido.');
  if (hasDate && !/^\d{4}-\d{2}-\d{2}$/.test(specificDate)) throw new HttpError(400, 'La fecha específica no es válida.');
  if (!validTime(startTime) || !validTime(endTime) || startTime >= endTime) throw new HttpError(400, 'El horario debe tener inicio y fin válidos.');
  if (activeFrom && !/^\d{4}-\d{2}-\d{2}$/.test(activeFrom)) throw new HttpError(400, 'La fecha de inicio de vigencia no es válida.');
  if (activeUntil && !/^\d{4}-\d{2}-\d{2}$/.test(activeUntil)) throw new HttpError(400, 'La fecha de fin de vigencia no es válida.');
  if (activeFrom && activeUntil && activeUntil < activeFrom) throw new HttpError(400, 'La fecha final de vigencia no puede ser anterior a la inicial.');
  const client = await pool.connect();
  let availability;
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    const block = await lockAvailability(client, req.params.id, req.user.id);
    await assertBlockHasNoFutureSessions(client, block);
    const { rows } = await client.query(
      `UPDATE availabilities SET weekday = $1, specific_date = $2, start_time = $3, end_time = $4,
         active_from = $5, active_until = $6
       WHERE id = $7 AND mentor_id = $8
       RETURNING id, weekday, specific_date, to_char(start_time, 'HH24:MI') AS start_time,
         to_char(end_time, 'HH24:MI') AS end_time, active_from, active_until`,
      [hasWeekday ? Number(weekday) : null, hasDate ? specificDate : null, startTime, endTime, activeFrom || null, activeUntil || null, req.params.id, req.user.id],
    );
    availability = rows[0];
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  res.json({ availability });
});
