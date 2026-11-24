import { pool } from '../db/pool.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notifyUser } from '../services/notifications.js';
import { canViewAppointment } from '../utils/accessRules.js';

async function getAppointmentForUser(appointmentId, user) {
  const { rows } = await pool.query('SELECT * FROM appointments WHERE id = $1', [appointmentId]);
  const appointment = rows[0];
  if (!appointment) throw new HttpError(404, 'Mentoría no encontrada.');
  if (!canViewAppointment(user, appointment)) {
    throw new HttpError(403, 'No tienes acceso a los archivos de esta mentoría.');
  }
  return appointment;
}

function fileMetadata(file) {
  if (!file) throw new HttpError(400, 'Selecciona un archivo para continuar.');
  return {
    originalName: file.originalname.slice(0, 255),
    storedName: file.filename,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    filePath: file.path,
  };
}

export const createEvidence = asyncHandler(async (req, res) => {
  if (!['mentor', 'mentorado'].includes(req.user.role)) throw new HttpError(403, 'Solo mentor y mentorado pueden agregar evidencias.');
  const appointment = await getAppointmentForUser(req.params.id, req.user);
  if (!['confirmada', 'realizada'].includes(appointment.status)) throw new HttpError(400, 'Solo puedes subir evidencias en citas confirmadas o realizadas.');
  const file = fileMetadata(req.file);
  const description = String(req.body.description || '').trim().slice(0, 1000);
  const { rows } = await pool.query(
    `INSERT INTO evidences (appointment_id, uploaded_by, description, original_name, stored_name, mime_type, size_bytes, file_path)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, appointment_id, uploaded_by, description, original_name, mime_type, size_bytes, review_status, created_at`,
    [appointment.id, req.user.id, description, file.originalName, file.storedName, file.mimeType, file.sizeBytes, file.filePath],
  );
  const recipient = req.user.id === appointment.mentor_id ? appointment.mentee_id : appointment.mentor_id;
  await notifyUser(recipient, 'evidencia_cargada', `${req.user.full_name} agregó una evidencia a la mentoría "${appointment.topic}".`, 'appointment', appointment.id, 'Nueva evidencia en MentorHub');
  res.status(201).json({ evidence: rows[0] });
});

export const listEvidence = asyncHandler(async (req, res) => {
  await getAppointmentForUser(req.params.id, req.user);
  const { rows } = await pool.query(
    `SELECT e.id, e.appointment_id, e.uploaded_by, e.description, e.original_name, e.mime_type,
            e.size_bytes, e.review_status, e.review_comment, e.reviewed_at, e.created_at, u.full_name AS uploaded_by_name
     FROM evidences e JOIN users u ON u.id = e.uploaded_by
     WHERE e.appointment_id = $1 ORDER BY e.created_at DESC`,
    [req.params.id],
  );
  res.json({ evidences: rows });
});

export const reviewEvidence = asyncHandler(async (req, res) => {
  const status = String(req.body.status || '');
  if (!['aprobada', 'correccion'].includes(status)) throw new HttpError(400, 'La revisión debe ser aprobada o requerir corrección.');
  const { rows } = await pool.query(
    `SELECT e.*, a.mentor_id, a.mentee_id, a.topic FROM evidences e
     JOIN appointments a ON a.id = e.appointment_id WHERE e.id = $1`,
    [req.params.id],
  );
  const evidence = rows[0];
  if (!evidence) throw new HttpError(404, 'Evidencia no encontrada.');
  if (req.user.role !== 'mentor' || req.user.id !== evidence.mentor_id) throw new HttpError(403, 'Solo el mentor de la cita puede revisar la evidencia.');
  if (evidence.uploaded_by === req.user.id) throw new HttpError(400, 'No puedes revisar tu propia evidencia.');
  const comment = String(req.body.comment || '').trim().slice(0, 1000);
  const result = await pool.query(
    `UPDATE evidences SET review_status = $1, review_comment = $2, reviewed_at = NOW()
     WHERE id = $3 RETURNING id, review_status, review_comment, reviewed_at`,
    [status, comment, req.params.id],
  );
  await notifyUser(evidence.uploaded_by, 'evidencia_revisada', `Tu evidencia de "${evidence.topic}" fue ${status === 'aprobada' ? 'aprobada' : 'marcada para corrección'}. ${comment}`, 'appointment', evidence.appointment_id, 'Evidencia revisada');
  res.json({ evidence: result.rows[0] });
});

export const downloadEvidence = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT e.*, a.mentor_id, a.mentee_id FROM evidences e
     JOIN appointments a ON a.id = e.appointment_id WHERE e.id = $1`,
    [req.params.id],
  );
  const item = rows[0];
  if (!item) throw new HttpError(404, 'Archivo no encontrado.');
  if (!canViewAppointment(req.user, item)) throw new HttpError(403, 'No tienes permiso para descargar este archivo.');
  res.download(item.file_path, item.original_name);
});

export const createDocumentRequest = asyncHandler(async (req, res) => {
  if (!['mentor', 'mentorado'].includes(req.user.role)) throw new HttpError(403, 'Solo mentor y mentorado pueden solicitar documentos.');
  const appointment = await getAppointmentForUser(req.params.id, req.user);
  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim().slice(0, 1500);
  const dueAt = req.body.due_at;
  if (title.length < 3 || title.length > 180 || !dueAt || new Date(dueAt) <= new Date()) throw new HttpError(400, 'Indica un título y una fecha límite futura.');
  if (!['confirmada', 'realizada'].includes(appointment.status)) throw new HttpError(409, 'La tutoría debe estar confirmada o realizada para solicitar documentos.');
  const recipientId = req.user.id === appointment.mentor_id ? appointment.mentee_id : appointment.mentor_id;
  const { rows } = await pool.query(
    `INSERT INTO document_requests (appointment_id, requester_id, recipient_id, title, description, due_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [appointment.id, req.user.id, recipientId, title, description, dueAt],
  );
  await notifyUser(recipientId, 'documento_solicitado', `${req.user.full_name} te solicitó el documento "${title}". Fecha límite: ${new Date(dueAt).toLocaleString('es-MX')}.`, 'document_request', rows[0].id, 'Te solicitaron un documento');
  res.status(201).json({ request: rows[0] });
});

export const listDocumentRequests = asyncHandler(async (req, res) => {
  const params = [];
  let where = '';
  if (req.user.role !== 'admin') {
    params.push(req.user.id);
    where = 'WHERE (dr.requester_id = $1 OR dr.recipient_id = $1)';
  }
  const { rows } = await pool.query(
    `SELECT dr.*, a.topic, requester.full_name AS requester_name, recipient.full_name AS recipient_name,
       dd.id AS delivery_id, dd.original_name AS delivery_name, dd.mime_type AS delivery_mime,
       dd.delivery_comment, dd.review_comment
     FROM document_requests dr
     JOIN appointments a ON a.id = dr.appointment_id
     JOIN users requester ON requester.id = dr.requester_id
     JOIN users recipient ON recipient.id = dr.recipient_id
     LEFT JOIN document_deliveries dd ON dd.request_id = dr.id
     ${where} ORDER BY dr.due_at ASC`,
    params,
  );
  res.json({ requests: rows });
});

export const deliverDocument = asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM document_requests WHERE id = $1', [req.params.id]);
  const request = rows[0];
  if (!request) throw new HttpError(404, 'Solicitud de documento no encontrada.');
  if (request.recipient_id !== req.user.id) throw new HttpError(403, 'Solo la persona destinataria puede entregar este documento.');
  if (!['pendiente', 'rechazado', 'vencido'].includes(request.status)) throw new HttpError(400, 'Esta solicitud no admite otra entrega.');
  const file = fileMetadata(req.file);
  const comment = String(req.body.comment || '').trim().slice(0, 1000);
  const { rows: deliveries } = await pool.query(
    `INSERT INTO document_deliveries (request_id, uploaded_by, original_name, stored_name, mime_type, size_bytes, file_path, delivery_comment)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (request_id) DO UPDATE SET uploaded_by = EXCLUDED.uploaded_by,
       original_name = EXCLUDED.original_name, stored_name = EXCLUDED.stored_name,
       mime_type = EXCLUDED.mime_type, size_bytes = EXCLUDED.size_bytes,
       file_path = EXCLUDED.file_path, delivery_comment = EXCLUDED.delivery_comment,
       review_comment = NULL, created_at = NOW()
     RETURNING id`,
    [request.id, req.user.id, file.originalName, file.storedName, file.mimeType, file.sizeBytes, file.filePath, comment],
  );
  await pool.query("UPDATE document_requests SET status = 'entregado' WHERE id = $1", [request.id]);
  await notifyUser(request.requester_id, 'documento_entregado', `${req.user.full_name} entregó el documento solicitado: "${request.title}".`, 'document_request', request.id, 'Documento entregado');
  res.status(201).json({ delivery: { id: deliveries[0].id }, message: 'Documento entregado.' });
});

export const reviewDocument = asyncHandler(async (req, res) => {
  const status = String(req.body.status || '');
  if (!['aceptado', 'rechazado'].includes(status)) throw new HttpError(400, 'La revisión debe aceptarse o rechazarse.');
  const { rows } = await pool.query(
    `SELECT dr.*, dd.id AS delivery_id, dd.uploaded_by FROM document_requests dr
     LEFT JOIN document_deliveries dd ON dd.request_id = dr.id WHERE dr.id = $1`,
    [req.params.id],
  );
  const request = rows[0];
  if (!request) throw new HttpError(404, 'Solicitud de documento no encontrada.');
  if (request.requester_id !== req.user.id) throw new HttpError(403, 'Solo quien solicitó el documento puede revisarlo.');
  if (request.status !== 'entregado' || !request.delivery_id) throw new HttpError(400, 'El documento todavía no ha sido entregado.');
  const comment = String(req.body.comment || '').trim().slice(0, 1000);
  if (status === 'rechazado' && comment.length < 3) throw new HttpError(400, 'Explica brevemente qué debe corregirse.');
  await pool.query('UPDATE document_requests SET status = $1 WHERE id = $2', [status, req.params.id]);
  await pool.query('UPDATE document_deliveries SET review_comment = $1 WHERE id = $2', [comment, request.delivery_id]);
  await notifyUser(request.recipient_id, 'documento_revisado', `El documento "${request.title}" fue ${status === 'aceptado' ? 'aceptado' : 'rechazado'}. ${comment}`, 'document_request', request.id, 'Documento revisado');
  res.json({ message: `Documento ${status}.`, status });
});

export const downloadDocument = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT dd.*, dr.requester_id, dr.recipient_id
     FROM document_deliveries dd JOIN document_requests dr ON dr.id = dd.request_id
     WHERE dd.id = $1`,
    [req.params.id],
  );
  const item = rows[0];
  if (!item) throw new HttpError(404, 'Archivo no encontrado.');
  if (req.user.role !== 'admin' && ![item.requester_id, item.recipient_id].includes(req.user.id)) throw new HttpError(403, 'No tienes permiso para descargar este archivo.');
  res.download(item.file_path, item.original_name);
});
