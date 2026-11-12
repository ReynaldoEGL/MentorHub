import { pool } from '../db/pool.js';
import { sendEmail } from './email.js';

export async function notifyUser(userId, type, message, resourceType = null, resourceId = null, emailSubject = null) {
  const { rows } = await pool.query(
    `INSERT INTO notifications (user_id, type, message, resource_type, resource_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [userId, type, message, resourceType, resourceId],
  );
  const user = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
  if (emailSubject && user.rows[0]?.email) {
    await sendEmail({ to: user.rows[0].email, subject: emailSubject, text: message });
  }
  return rows[0];
}
