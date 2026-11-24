import { Router } from 'express';
import { getStatistics, exportAppointmentsCsv } from '../controllers/adminController.js';
const router = Router();
router.get('/estadisticas', getStatistics);
router.get('/reportes/citas.csv', exportAppointmentsCsv);
export default router;
