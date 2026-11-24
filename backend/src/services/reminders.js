import cron from 'node-cron';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { notifyUser } from './notifications.js';

async function processReminders() {
  const appointments = await pool.query(
    `UPDATE appointments SET reminder_sent = TRUE
     WHERE reminder_sent = FALSE AND status = 'confirmada'
       AND start_at BETWEEN NOW() + INTERVAL '23 hours 45 minutes'
                        AND NOW() + INTERVAL '24 hours 15 minutes'
     RETURNING id, mentor_id, mentee_id, topic, start_at`,
  );
  for (const appointment of appointments.rows) {
    const message = `Recordatorio: mañana tienes una mentoría de "${appointment.topic}". Fecha: ${new Date(appointment.start_at).toLocaleString('es-MX', { timeZone: env.timezone })}.`;
    await Promise.all([
      notifyUser(appointment.mentor_id, 'recordatorio_cita', message, 'appointment', appointment.id, 'Recordatorio de mentoría'),
      notifyUser(appointment.mentee_id, 'recordatorio_cita', message, 'appointment', appointment.id, 'Recordatorio de mentoría'),
    ]);
  }

  const documents = await pool.query(
    `UPDATE document_requests SET due_reminder_sent = TRUE
     WHERE due_reminder_sent = FALSE AND status IN ('pendiente', 'rechazado')
       AND due_at BETWEEN NOW() + INTERVAL '23 hours 45 minutes'
                      AND NOW() + INTERVAL '24 hours 15 minutes'
     RETURNING id, recipient_id, title, due_at`,
  );
  for (const request of documents.rows) {
    const message = `Recordatorio: el documento "${request.title}" vence mañana (${new Date(request.due_at).toLocaleString('es-MX', { timeZone: env.timezone })}).`;
    await notifyUser(request.recipient_id, 'recordatorio_documento', message, 'document_request', request.id, 'Documento próximo a vencer');
  }

  await pool.query(
    `UPDATE document_requests SET status = 'vencido'
     WHERE status IN ('pendiente', 'rechazado') AND due_at < NOW()`,
  );
}

export function startReminderJobs() {
  cron.schedule('*/15 * * * *', () => {
    processReminders().catch((error) => console.error('Error al procesar recordatorios:', error));
  }, { timezone: env.timezone });
}

export { processReminders };
