import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import { requireRole } from '../middleware/auth.js';
import {
  createEvidence, listEvidence, reviewEvidence, downloadEvidence,
  createDocumentRequest, listDocumentRequests, deliverDocument, reviewDocument, downloadDocument,
} from '../controllers/filesController.js';
const router = Router();
router.post('/citas/:id/evidencias', requireRole('mentor', 'mentorado'), upload.single('file'), createEvidence);
router.get('/citas/:id/evidencias', listEvidence);
router.patch('/evidencias/:id/revision', reviewEvidence);
router.get('/archivos/evidencias/:id', downloadEvidence);
router.post('/citas/:id/solicitudes-documentos', requireRole('mentor', 'mentorado'), createDocumentRequest);
router.get('/solicitudes-documentos', listDocumentRequests);
router.post('/solicitudes-documentos/:id/entrega', requireRole('mentor', 'mentorado'), upload.single('file'), deliverDocument);
router.patch('/solicitudes-documentos/:id/revision', reviewDocument);
router.get('/archivos/documentos/:id', downloadDocument);
export default router;
