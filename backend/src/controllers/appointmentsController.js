import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notifyUser } from '../services/notifications.js';

function localParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'La fecha de la cita no es válida.');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: env.timezone,
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    weekday: dayMap[map.weekday],
    time: `${map.hour}:${map.minute}`,
  };
}

async function assertSlotAvailable(client, mentorId, startAt, endAt, excludeAppointmentId = null) {
  const start = localParts(startAt);
  const end = localParts(endAt);
  if (start.date !== end.date || start.time >= end.time) {
    throw new HttpError(400, 'La mentoría debe comenzar y terminar el mismo día, con una hora final posterior.');
  }
  if (new Date(startAt) <= new Date()) throw new HttpError(400, 'La cita debe programarse en una fecha futura.');

  const availability = await client.query(
    `SELECT id FROM availabilities
     WHERE mentor_id = $1
       AND (specific_date = $2::date OR (weekday = $3 AND (active_from IS NULL OR active_from <= $2::date)
         AND (active_until IS NULL OR active_until >= $2::date)))
       AND start_time <= $4::time AND end_time >= $5::time
     LIMIT 1`,
    [mentorId, start.date, start.weekday, start.time, end.time],
  );
  if (!availability.rows[0]) throw new HttpError(400, 'El horario seleccionado no está dentro de la disponibilidad publicada por el mentor.');

  const overlap = await client.query(
    `SELECT id FROM appointments
     WHERE mentor_id = $1 AND status IN ('solicitada', 'confirmada')
       AND start_at < $3::timestamptz AND end_at > $2::timestamptz
       AND ($4::uuid IS NULL OR id <> $4::uuid)
     LIMIT 1`,
    [mentorId, startAt, endAt, excludeAppointmentId],
  );
  if (overlap.rows[0]) throw new HttpError(409, 'Ese horario ya fue solicitado o reservado. Selecciona otro.');
}

const appointmentSelect = `
  SELECT a.*, mentor.full_name AS mentor_name, mentee.full_name AS mentee_name
  FROM appointments a
  JOIN users mentor ON mentor.id = a.mentor_id
  JOIN users mentee ON mentee.id = a.mentee_id`;

export const listAppointments = asyncHandler(async (req, res) => {
  const params = [];
  let where = '';
  if (req.user.role === 'mentor') { params.push(req.user.id); where = 'WHERE a.mentor_id = $1'; }
  else if (req.user.role === 'mentorado') { params.push(req.user.id); where = 'WHERE a.mentee_id = $1'; }
  const { rows } = await pool.query(`${appointmentSelect} ${where} ORDER BY a.start_at DESC LIMIT 200`, params);
  res.json({ appointments: rows });
});

export const getAppointment = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`${appointmentSelect} WHERE a.id = $1`, [req.params.id]);
  const appointment = rows[0];
  if (!appointment) throw new HttpError(404, 'Mentoría no encontrada.');
  if (req.user.role !== 'admin' && ![appointment.mentor_id, appointment.mentee_id].includes(req.user.id)) {
    throw new HttpError(403, 'No tienes acceso a esta mentoría.');
  }
  res.json({ appointment });
});

export const createAppointment = asyncHandler(async (req, res) => {
  const mentorId = String(req.body.mentor_id || '');
  const startAt = req.body.start_at;
  const endAt = req.body.end_at;
  const topic = String(req.body.topic || '').trim();
  const modality = req.body.modality;
  if (!mentorId || !startAt || !endAt || topic.length < 3 || topic.length > 180) throw new HttpError(400, 'Completa mentor, horario y tema de la mentoría.');
  if (!['presencial', 'en_linea'].includes(modality)) throw new HttpError(400, 'La modalidad no es válida.');
  const mentor = await pool.query("SELECT id FROM users WHERE id = $1 AND role = 'mentor' AND is_active = TRUE", [mentorId]);
  if (!mentor.rows[0]) throw new HttpError(404, 'El mentor seleccionado no está disponible.');

  const client = await pool.connect();
  let appointment;
  try {
    await client.query('BEGIN');
    // Bloqueo por mentor para serializar reservas concurrentes del mismo recurso.
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [mentorId]);
    await assertSlotAvailable(client, mentorId, startAt, endAt);
    const { rows } = await client.query(
      `INSERT INTO appointments (mentor_id, mentee_id, start_at, end_at, topic, modality, location_or_link)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [mentorId, req.user.id, startAt, endAt, topic, modality, String(req.body.location_or_link || '').trim()],
    );
    appointment = rows[0];
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  await notifyUser(mentorId, 'cita_solicitada', `${req.user.full_name} solicitó una mentoría: ${topic}.`, 'appointment', appointment.id, 'Nueva solicitud de mentoría');
  res.status(201).json({ appointment });
});

export const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const nextStatus = String(req.body.status || '');
  const { rows } = await pool.query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
  const appointment = rows[0];
  if (!appointment) throw new HttpError(404, 'Mentoría no encontrada.');
  if (nextStatus === 'cancelada') {
    if (![appointment.mentor_id, appointment.mentee_id].includes(req.user.id) && req.user.role !== 'admin') throw new HttpError(403, 'No puedes cancelar esta cita.');
    if (new Date(appointment.start_at).getTime() - Date.now() < 24 * 60 * 60 * 1000) throw new HttpError(400, 'La cancelación debe realizarse con al menos 24 horas de anticipación.');
  } else {
    if (req.user.role !== 'mentor' && req.user.role !== 'admin') throw new HttpError(403, 'Solo el mentor puede actualizar el estado de la cita.');
    if (req.user.role !== 'admin' && appointment.mentor_id !== req.user.id) throw new HttpError(403, 'Esta mentoría no te pertenece.');
    const allowed = {
      solicitada: ['confirmada', 'rechazada'],
      confirmada: ['realizada'],
    };
    if (!(allowed[appointment.status] || []).includes(nextStatus)) throw new HttpError(400, 'La transición de estado no está permitida.');
  }
  if (!['solicitada', 'confirmada', 'rechazada', 'cancelada', 'realizada'].includes(nextStatus)) throw new HttpError(400, 'Estado no válido.');
  const notes = req.body.notes === undefined ? appointment.notes : String(req.body.notes).slice(0, 5000);
  const result = await pool.query(
    'UPDATE appointments SET status = $1, notes = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
    [nextStatus, notes, req.params.id],
  );
  const otherUser = req.user.id === appointment.mentor_id ? appointment.mentee_id : appointment.mentor_id;
  await notifyUser(otherUser, `cita_${nextStatus}`, `La mentoría "${appointment.topic}" cambió a estado: ${nextStatus}.`, 'appointment', appointment.id, 'Actualización de mentoría');
  res.json({ appointment: result.rows[0] });
});

export const rescheduleAppointment = asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
  const appointment = rows[0];
  if (!appointment) throw new HttpError(404, 'Mentoría no encontrada.');
  if (![appointment.mentor_id, appointment.mentee_id].includes(req.user.id) || req.user.role === 'admin') throw new HttpError(403, 'Solo las personas involucradas pueden reprogramar.');
  if (!['solicitada', 'confirmada'].includes(appointment.status)) throw new HttpError(400, 'Esta mentoría ya no puede reprogramarse.');
  const client = await pool.connect();
  let updated;
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [appointment.mentor_id]);
    await assertSlotAvailable(client, appointment.mentor_id, req.body.start_at, req.body.end_at, appointment.id);
    const result = await client.query(
      `UPDATE appointments SET start_at = $1, end_at = $2, status = 'solicitada',
       reminder_sent = FALSE, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [req.body.start_at, req.body.end_at, appointment.id],
    );
    updated = result.rows[0];
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK'); throw error;
  } finally { client.release(); }
  const recipient = req.user.id === appointment.mentor_id ? appointment.mentee_id : appointment.mentor_id;
  await notifyUser(recipient, 'cita_reprogramada', `Se propuso un nuevo horario para la mentoría "${appointment.topic}". Debe confirmarse nuevamente.`, 'appointment', appointment.id, 'Mentoría reprogramada');
  res.json({ appointment: updated });
});
