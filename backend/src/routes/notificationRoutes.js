import { Router } from 'express';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../controllers/notificationsController.js';
const router = Router();
router.get('/', listNotifications);
router.patch('/leer-todas', markAllNotificationsRead);
router.patch('/:id/leer', markNotificationRead);
export default router;
