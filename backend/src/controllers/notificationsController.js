import { pool } from '../db/pool.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listNotifications = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, type, message, resource_type, resource_id, is_read, created_at
     FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.user.id],
  );
  res.json({ notifications: rows, unread: rows.filter((item) => !item.is_read).length });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id, is_read',
    [req.params.id, req.user.id],
  );
  if (!rows[0]) throw new HttpError(404, 'Notificación no encontrada.');
  res.json({ notification: rows[0] });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE', [req.user.id]);
  res.json({ message: 'Notificaciones marcadas como leídas.' });
});
