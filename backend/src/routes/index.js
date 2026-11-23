import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pool } from '../db/pool.js';
import { register, login, me, forgotPassword, resetPassword } from '../controllers/authController.js';
import { updateOwnProfile, listUsers, changeUserRole, setUserActive } from '../controllers/usersController.js';
import { listMentors, getMentor, updateMentorProfile } from '../controllers/mentorsController.js';
import availabilityRoutes from './availabilityRoutes.js';
import appointmentRoutes from './appointmentRoutes.js';

const router = Router();

router.post('/auth/register', register);
router.post('/auth/login', login);
router.post('/auth/forgot-password', forgotPassword);
router.post('/auth/reset-password', resetPassword);
router.get('/auth/me', authenticate, me);
router.patch('/users/me', authenticate, updateOwnProfile);
router.get('/mentores', authenticate, listMentors);
router.get('/mentores/:id', authenticate, getMentor);
router.put('/mentores/me/perfil', authenticate, requireRole('mentor'), updateMentorProfile);
router.use('/disponibilidad', authenticate, availabilityRoutes);
router.use('/citas', authenticate, appointmentRoutes);
router.get('/admin/usuarios', authenticate, requireRole('admin'), listUsers);
router.patch('/admin/usuarios/:id/rol', authenticate, requireRole('admin'), changeUserRole);
router.patch('/admin/usuarios/:id/activo', authenticate, requireRole('admin'), setUserActive);
router.get('/_db-check', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT NOW() AS database_time');
  res.json(result.rows[0]);
}));

export default router;
