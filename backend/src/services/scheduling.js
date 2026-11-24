import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

// El horario se valida en la zona institucional; la API recibe ISO con zona horaria.
import { localParts as parts, validateSessionWindow } from '../utils/sessionTimeRules.js';

export const localParts = (value) => parts(value, env.timezone);
export const validateSessionTimes = (startAt, endAt, now = new Date()) => validateSessionWindow(startAt, endAt, env.timezone, now);

export async function requireAvailability(client, mentorId, startAt, endAt) {
  const { start, end } = validateSessionTimes(startAt, endAt);
  const result = await client.query(
    `SELECT id FROM availabilities WHERE mentor_id = $1
     AND (specific_date = $2::date OR (weekday = $3
       AND (active_from IS NULL OR active_from <= $2::date)
       AND (active_until IS NULL OR active_until >= $2::date)))
     AND start_time <= $4::time AND end_time >= $5::time LIMIT 1`,
    [mentorId, start.date, start.weekday, start.time, end.time],
  );
  if (!result.rowCount) throw new HttpError(400, 'El horario no está dentro de la disponibilidad publicada por el mentor.');
}

export async function requireNoMentorConflict(client, mentorId, startAt, endAt, excludeOfferingId = null, excludeAppointmentId = null) {
  const appointment = await client.query(
    `SELECT id FROM appointments WHERE mentor_id = $1
       AND status IN ('solicitada','confirmada')
       AND start_at < $3::timestamptz AND end_at > $2::timestamptz
       AND ($4::uuid IS NULL OR id <> $4::uuid)
       LIMIT 1`, [mentorId, startAt, endAt, excludeAppointmentId],
  );
  if (appointment.rowCount) throw new HttpError(409, 'El mentor ya tiene una cita en ese horario.');
  const offering = await client.query(
    `SELECT id FROM tutoring_offerings WHERE mentor_id = $1 AND status = 'abierta'
       AND start_at < $3::timestamptz AND end_at > $2::timestamptz
       AND ($4::uuid IS NULL OR id <> $4::uuid)
       LIMIT 1`, [mentorId, startAt, endAt, excludeOfferingId],
  );
  if (offering.rowCount) throw new HttpError(409, 'El mentor ya publicó otra tutoría en ese horario.');
}

export async function requireNoMenteeConflict(client, menteeId, startAt, endAt, excludeAppointmentId = null) {
  const result = await client.query(
    `SELECT id FROM appointments WHERE mentee_id = $1 AND status IN ('solicitada','confirmada')
       AND start_at < $3::timestamptz AND end_at > $2::timestamptz
       AND ($4::uuid IS NULL OR id <> $4::uuid) LIMIT 1`,
    [menteeId, startAt, endAt, excludeAppointmentId],
  );
  if (result.rowCount) throw new HttpError(409, 'El tutorado ya tiene otra tutoría en ese horario.');
}
