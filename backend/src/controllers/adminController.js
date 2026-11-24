import { pool } from '../db/pool.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getStatistics = asyncHandler(async (req, res) => {
  const [users, appointments, documents, mentors] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active)::int AS active FROM users`),
    pool.query(`SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'solicitada')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'confirmada')::int AS confirmed,
      COUNT(*) FILTER (WHERE status = 'realizada')::int AS completed
      FROM appointments`),
    pool.query(`SELECT COUNT(*)::int AS pending FROM document_requests WHERE status IN ('pendiente','entregado','rechazado','vencido')`),
    pool.query(`SELECT COUNT(*)::int AS total FROM users WHERE role = 'mentor' AND is_active = TRUE`),
  ]);
  res.json({ stats: {
    total_users: users.rows[0].total,
    active_users: users.rows[0].active,
    total_appointments: appointments.rows[0].total,
    pending_appointments: appointments.rows[0].pending,
    confirmed_appointments: appointments.rows[0].confirmed,
    completed_appointments: appointments.rows[0].completed,
    pending_documents: documents.rows[0].pending,
    active_mentors: mentors.rows[0].total,
  } });
});

function csvCell(value) {
  const text = value == null ? '' : String(value);
  const safe = /^[=+@\-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export const exportAppointmentsCsv = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.id, a.topic, mentor.full_name AS mentor, mentee.full_name AS mentorado,
       a.start_at, a.end_at, a.modality, a.status, a.created_at
     FROM appointments a JOIN users mentor ON mentor.id = a.mentor_id
     JOIN users mentee ON mentee.id = a.mentee_id ORDER BY a.start_at DESC`,
  );
  const columns = ['id', 'tema', 'mentor', 'mentorado', 'inicio', 'fin', 'modalidad', 'estado', 'creada'];
  const lines = [columns.map(csvCell).join(',')];
  for (const item of rows) {
    lines.push([
      item.id, item.topic, item.mentor, item.mentorado, item.start_at?.toISOString(),
      item.end_at?.toISOString(), item.modality, item.status, item.created_at?.toISOString(),
    ].map(csvCell).join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="mentorhub-mentorias.csv"');
  res.send(`\uFEFF${lines.join('\r\n')}`);
});
