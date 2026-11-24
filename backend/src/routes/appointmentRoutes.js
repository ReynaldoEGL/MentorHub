import { Router } from 'express';
import { getAppointment, listAppointments, rescheduleAppointment, updateAppointmentStatus, updateAppointmentNotes } from '../controllers/appointmentsController.js';
const router = Router();
router.get('/', listAppointments);
router.get('/:id', getAppointment);
router.patch('/:id/estado', updateAppointmentStatus);
router.patch('/:id/reprogramar', rescheduleAppointment);
router.patch('/:id/notas', updateAppointmentNotes);
export default router;
