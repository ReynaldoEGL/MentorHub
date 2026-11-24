import { pool } from '../db/pool.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notifyUser } from '../services/notifications.js';
import { canEditOffering, canAssignMentee } from '../utils/accessRules.js';
import {
  requireAvailability, requireNoMentorConflict, requireNoMenteeConflict,
  validateSessionTimes,
} from '../services/scheduling.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateOffer(body) {
  const topic = String(body?.topic ?? '').trim();
  const modality = String(body?.modality ?? '');
  const location = String(body?.location_or_link ?? '').trim();
  if (topic.length < 3 || topic.length > 180) throw new HttpError(400, 'El tema debe tener entre 3 y 180 caracteres.');
  if (!['presencial', 'en_linea'].includes(modality)) throw new HttpError(400, 'Selecciona una modalidad válida.');
  if (location.length > 2000) throw new HttpError(400, 'El lugar o enlace no puede superar 2000 caracteres.');
  validateSessionTimes(body?.start_at, body?.end_at);
  return { topic, modality, location, startAt: body.start_at, endAt: body.end_at };
}

function assertId(value) {
  if (!uuidPattern.test(String(value || ''))) throw new HttpError(400, 'Identificador no válido.');
}

const offeringSelect = `
  SELECT o.*, u.full_name AS mentor_name,
      a.id AS appointment_id, a.status AS appointment_status,
      a.mentee_id, mentee.full_name AS mentee_name,
      a.assigned_at, a.assigned_by
  FROM tutoring_offerings o
  JOIN users u ON u.id = o.mentor_id
  LEFT JOIN appointments a ON a.offering_id = o.id
  LEFT JOIN users mentee ON mentee.id = a.mentee_id`;

export const listOfferings = asyncHandler(async (req, res) => {
  const params = [];
  const where = req.user.role === 'mentor' ? 'WHERE o.mentor_id = $1' : '';
  if (req.user.role === 'mentor') params.push(req.user.id);
  const { rows } = await pool.query(`${offeringSelect} ${where} ORDER BY o.start_at DESC LIMIT 300`, params);
  res.json({ offerings: rows });
});

export const listAssignableMentees = asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, full_name, email FROM users
     WHERE role = 'mentorado' AND is_active = TRUE ORDER BY full_name LIMIT 500`,
  );
  res.json({ mentees: rows });
});

export const createOffering = asyncHandler(async (req, res) => {
  const { topic, modality, location, startAt, endAt } = validateOffer(req.body);
  const client = await pool.connect();
  let offering;
  try {
    await client.query('BEGIN');
    // El bloqueo de mentor serializa publicaciones y asignaciones para el mismo docente.
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    await requireAvailability(client, req.user.id, startAt, endAt);
    await requireNoMentorConflict(client, req.user.id, startAt, endAt);
    const result = await client.query(
      `INSERT INTO tutoring_offerings (mentor_id, topic, modality, location_or_link, start_at, end_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.id, topic, modality, location, startAt, endAt],
    );
    offering = result.rows[0];
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
  res.status(201).json({ offering });
});

export const updateOffering = asyncHandler(async (req, res) => {
  assertId(req.params.id);
  const { topic, modality, location, startAt, endAt } = validateOffer(req.body);
  const client = await pool.connect();
  let offering;
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    const { rows } = await client.query('SELECT * FROM tutoring_offerings WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!canEditOffering(req.user, rows[0])) throw new HttpError(404, 'Tutoría no encontrada.');
    if (rows[0].status !== 'abierta') throw new HttpError(409, 'Esta tutoría fue cancelada.');
    const assigned = await client.query('SELECT id FROM appointments WHERE offering_id = $1', [req.params.id]);
    if (assigned.rowCount) throw new HttpError(409, 'Una tutoría asignada no se puede editar. Contacta al administrador.');
    await requireAvailability(client, req.user.id, startAt, endAt);
    await requireNoMentorConflict(client, req.user.id, startAt, endAt, req.params.id);
    const result = await client.query(
      `UPDATE tutoring_offerings SET topic = $1, modality = $2, location_or_link = $3,
          start_at = $4, end_at = $5, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [topic, modality, location, startAt, endAt, req.params.id],
    );
    offering = result.rows[0];
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  res.json({ offering });
});

export const cancelOffering = asyncHandler(async (req, res) => {
  assertId(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    const { rows } = await client.query('SELECT id, mentor_id, status FROM tutoring_offerings WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!canEditOffering(req.user, rows[0])) throw new HttpError(404, 'Tutoría no encontrada.');
    if (rows[0].status !== 'abierta') throw new HttpError(409, 'Esta tutoría ya está cancelada.');
    const assigned = await client.query('SELECT id FROM appointments WHERE offering_id = $1', [req.params.id]);
    if (assigned.rowCount) throw new HttpError(409, 'Una tutoría asignada debe cancelarla el administrador.');
    await client.query("UPDATE tutoring_offerings SET status = 'cancelada', updated_at = NOW() WHERE id = $1", [req.params.id]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  res.json({ message: 'Tutoría retirada del catálogo de asignación.' });
});

export const assignOffering = asyncHandler(async (req, res) => {
  if (!canAssignMentee(req.user)) throw new HttpError(403, 'Solo administración puede asignar tutorados.');
  assertId(req.params.id);
  assertId(req.body?.mentee_id);
  const menteeId = req.body.mentee_id;
  const client = await pool.connect();
  let appointment;
  try {
    await client.query('BEGIN');
    // Primero se consulta la oferta, luego se bloquean ambos usuarios (orden estable)
    // para evitar duplicación de reservas entre administradores concurrentes.
    const { rows: offerRows } = await client.query('SELECT * FROM tutoring_offerings WHERE id = $1', [req.params.id]);
    const offering = offerRows[0];
    if (!offering) throw new HttpError(404, 'Tutoría no encontrada.');
    for (const userId of [offering.mentor_id, menteeId].sort()) {
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    }
    const { rows } = await client.query('SELECT * FROM tutoring_offerings WHERE id = $1 FOR UPDATE', [req.params.id]);
    const current = rows[0];
    if (current.status !== 'abierta') throw new HttpError(409, 'Esta tutoría ya no admite asignaciones.');
    const existing = await client.query('SELECT id FROM appointments WHERE offering_id = $1', [req.params.id]);
    if (existing.rowCount) throw new HttpError(409, 'Esta tutoría ya tiene un tutorado asignado.');
    const users = await client.query(
      `SELECT id, role, is_active FROM users WHERE id IN ($1,$2)`,
      [current.mentor_id, menteeId],
    );
    const mentor = users.rows.find((u) => u.id === current.mentor_id);
    const mentee = users.rows.find((u) => u.id === menteeId);
    if (!mentor?.is_active || mentor.role !== 'mentor') throw new HttpError(409, 'El mentor ya no está disponible.');
    if (!mentee?.is_active || mentee.role !== 'mentorado') throw new HttpError(400, 'Selecciona un tutorado activo.');
    await requireAvailability(client, current.mentor_id, current.start_at, current.end_at);
    // Se excluye la oferta propia, pero se revisan todos los demás horarios ocupados.
    await requireNoMentorConflict(client, current.mentor_id, current.start_at, current.end_at, current.id);
    await requireNoMenteeConflict(client, menteeId, current.start_at, current.end_at);
    const result = await client.query(
      `INSERT INTO appointments
        (mentor_id, mentee_id, start_at, end_at, topic, modality, location_or_link,
         status, offering_id, assigned_by, assigned_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'confirmada',$8,$9,NOW()) RETURNING *`,
      [current.mentor_id, menteeId, current.start_at, current.end_at, current.topic,
        current.modality, current.location_or_link, current.id, req.user.id],
    );
    appointment = result.rows[0];
    await client.query(
      `INSERT INTO tutoring_assignment_audit (appointment_id, offering_id, actor_id, mentee_id, action)
       VALUES ($1,$2,$3,$4,'asignada')`,
      [appointment.id, current.id, req.user.id, menteeId],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw new HttpError(409, 'Esta tutoría ya fue asignada. Actualiza la lista.');
    throw error;
  } finally { client.release(); }
  await Promise.all([
    notifyUser(appointment.mentor_id, 'tutoria_asignada', `Se asignó un tutorado a tu tutoría: "${appointment.topic}".`, 'appointment', appointment.id, 'Tutoría asignada'),
    notifyUser(menteeId, 'tutoria_asignada', `Se te asignó la tutoría "${appointment.topic}".`, 'appointment', appointment.id, 'Tienes una nueva tutoría'),
  ]);
  res.status(201).json({ appointment });
});
