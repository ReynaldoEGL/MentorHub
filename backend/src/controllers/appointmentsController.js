import { pool } from '../db/pool.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notifyUser } from '../services/notifications.js';
import { canViewAppointment } from '../utils/accessRules.js';
import {
  requireAvailability, requireNoMentorConflict, requireNoMenteeConflict,
  validateSessionTimes,
} from '../services/scheduling.js';

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
  if (!canViewAppointment(req.user, appointment)) {
    throw new HttpError(403, 'No tienes acceso a esta tutoría.');
  }
  res.json({ appointment });
});

export const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const nextStatus = String(req.body?.status ?? '');
  const client = await pool.connect();
  let appointment;
  try {
    await client.query('BEGIN');
    const beforeLock = await client.query('SELECT mentor_id, mentee_id FROM appointments WHERE id = $1', [req.params.id]);
    if (!beforeLock.rows[0]) throw new HttpError(404, 'Tutoría no encontrada.');
    // Mismo orden de bloqueo que publicar, asignar y reprogramar: evita carreras.
    for (const userId of [beforeLock.rows[0].mentor_id, beforeLock.rows[0].mentee_id].sort()) {
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    }
    const result = await client.query('SELECT * FROM appointments WHERE id = $1 FOR UPDATE', [req.params.id]);
    const item = result.rows[0];
    if (!item) throw new HttpError(404, 'Tutoría no encontrada.');
    let auditAction = null;
    if (nextStatus === 'realizada') {
      if (req.user.role !== 'mentor' || req.user.id !== item.mentor_id) {
        throw new HttpError(403, 'Solo el mentor asignado puede marcar la tutoría como realizada.');
      }
      if (item.status !== 'confirmada') throw new HttpError(409, 'La tutoría debe estar confirmada.');
      if (new Date(item.end_at) > new Date()) throw new HttpError(400, 'La tutoría podrá marcarse realizada después de su hora de término.');
    } else if (['confirmada', 'rechazada'].includes(nextStatus)) {
      if (req.user.role !== 'admin') throw new HttpError(403, 'Solo administración puede confirmar o rechazar solicitudes antiguas.');
      if (item.offering_id || item.status !== 'solicitada') throw new HttpError(409, 'Solo se pueden resolver las solicitudes anteriores a esta actualización.');
      auditAction = nextStatus === 'confirmada' ? 'confirmada_legacy' : 'rechazada_legacy';
      if (nextStatus === 'confirmada') {
        await validateForLegacyConfirmation(client, item);
      }
    } else if (nextStatus === 'cancelada') {
      if (req.user.role !== 'admin') throw new HttpError(403, 'Solo el administrador puede cancelar una asignación.');
      if (!['confirmada', 'solicitada'].includes(item.status)) throw new HttpError(409, 'Esta tutoría ya no puede cancelarse.');
      auditAction = 'cancelada';
    } else {
      throw new HttpError(400, 'Transición de estado no permitida.');
    }
    const notes = req.body?.notes === undefined ? item.notes : String(req.body.notes).slice(0, 5000);
    const updated = await client.query(
      'UPDATE appointments SET status = $1, notes = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [nextStatus, notes, item.id],
    );
    appointment = updated.rows[0];
    if (nextStatus === 'cancelada' && item.offering_id) {
      await client.query("UPDATE tutoring_offerings SET status = 'cancelada', updated_at = NOW() WHERE id = $1", [item.offering_id]);
    }
    if (auditAction) {
      await client.query(
        `INSERT INTO tutoring_assignment_audit (appointment_id, offering_id, actor_id, mentee_id, action)
         VALUES ($1,$2,$3,$4,$5)`,
        [item.id, item.offering_id, req.user.id, item.mentee_id, auditAction],
      );
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  const recipients = [...new Set([appointment.mentor_id, appointment.mentee_id].filter((id) => id !== req.user.id))];
  await Promise.all(recipients.map((id) => notifyUser(
    id, `tutoria_${nextStatus}`, `La tutoría "${appointment.topic}" cambió a: ${nextStatus}.`,
    'appointment', appointment.id, 'Actualización de tutoría',
  )));
  res.json({ appointment });
});

async function validateForLegacyConfirmation(client, item) {
  // Conservamos el historial anterior sin convertirlo automáticamente.
  await requireAvailability(client, item.mentor_id, item.start_at, item.end_at);
  await requireNoMentorConflict(client, item.mentor_id, item.start_at, item.end_at, null, item.id);
  await requireNoMenteeConflict(client, item.mentee_id, item.start_at, item.end_at, item.id);
}

export const rescheduleAppointment = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw new HttpError(403, 'Solo administración puede reprogramar tutorías asignadas.');
  const startAt = req.body?.start_at;
  const endAt = req.body?.end_at;
  validateSessionTimes(startAt, endAt);
  const client = await pool.connect();
  let appointment;
  try {
    await client.query('BEGIN');
    const initial = await client.query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    if (!initial.rows[0]) throw new HttpError(404, 'Tutoría no encontrada.');
    const origin = initial.rows[0];
    for (const userId of [origin.mentor_id, origin.mentee_id].sort()) {
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    }
    const locked = await client.query('SELECT * FROM appointments WHERE id = $1 FOR UPDATE', [req.params.id]);
    const item = locked.rows[0];
    if (!['solicitada', 'confirmada'].includes(item.status)) throw new HttpError(409, 'Esta tutoría ya no puede reprogramarse.');
    if (new Date(item.start_at) <= new Date()) throw new HttpError(409, 'No se pueden reprogramar tutorías que ya comenzaron.');
    await requireAvailability(client, item.mentor_id, startAt, endAt);
    await requireNoMentorConflict(client, item.mentor_id, startAt, endAt, item.offering_id, item.id);
    await requireNoMenteeConflict(client, item.mentee_id, startAt, endAt, item.id);
    if (item.offering_id) {
      await client.query(
        'UPDATE tutoring_offerings SET start_at = $1, end_at = $2, updated_at = NOW() WHERE id = $3',
        [startAt, endAt, item.offering_id],
      );
    }
    const result = await client.query(
      `UPDATE appointments SET start_at = $1, end_at = $2, reminder_sent = FALSE,
        updated_at = NOW() WHERE id = $3 RETURNING *`,
      [startAt, endAt, item.id],
    );
    appointment = result.rows[0];
    await client.query(
      `INSERT INTO tutoring_assignment_audit (appointment_id, offering_id, actor_id, mentee_id, action,
        details) VALUES ($1,$2,$3,$4,'reprogramada',$5::jsonb)`,
      [item.id, item.offering_id, req.user.id, item.mentee_id, JSON.stringify({ old_start: item.start_at, old_end: item.end_at, new_start: startAt, new_end: endAt })],
    );
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  await Promise.all([appointment.mentor_id, appointment.mentee_id].map((id) => notifyUser(
    id, 'tutoria_reprogramada', `Administración modificó el horario de "${appointment.topic}".`,
    'appointment', appointment.id, 'Tutoría reprogramada',
  )));
  res.json({ appointment });
});

export const updateAppointmentNotes = asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
  const appointment = rows[0];
  if (!appointment) throw new HttpError(404, 'Tutoría no encontrada.');
  if (req.user.role !== 'mentor' || appointment.mentor_id !== req.user.id) {
    throw new HttpError(403, 'Solo el mentor de esta tutoría puede registrar notas.');
  }
  if (!['confirmada', 'realizada'].includes(appointment.status)) throw new HttpError(409, 'Esta tutoría no admite notas todavía.');
  const notes = String(req.body?.notes ?? '').trim().slice(0, 5000);
  const result = await pool.query(
    'UPDATE appointments SET notes = $1, updated_at = NOW() WHERE id = $2 RETURNING notes',
    [notes, req.params.id],
  );
  res.json({ notes: result.rows[0].notes });
});
