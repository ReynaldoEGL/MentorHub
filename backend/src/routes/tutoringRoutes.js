import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import {
  listOfferings, listAssignableMentees, createOffering,
  updateOffering, cancelOffering, assignOffering,
} from '../controllers/tutoringController.js';

const router = Router();
router.get('/', requireRole('mentor', 'admin'), listOfferings);
router.get('/tutorados', requireRole('admin'), listAssignableMentees);
router.post('/', requireRole('mentor'), createOffering);
router.put('/:id', requireRole('mentor'), updateOffering);
router.delete('/:id', requireRole('mentor'), cancelOffering);
router.post('/:id/asignar', requireRole('admin'), assignOffering);
export default router;
