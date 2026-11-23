import { Router } from 'express';
import { createAppointment, getAppointment, listAppointments, rescheduleAppointment, updateAppointmentStatus } from '../controllers/appointmentsController.js';
const router = Router();
router.get('/', listAppointments);
router.post('/', createAppointment);
router.get('/:id', getAppointment);
router.patch('/:id/estado', updateAppointmentStatus);
router.patch('/:id/reprogramar', rescheduleAppointment);
export default router;
