import multer from 'multer';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, resolve } from 'node:path';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const allowed = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

await mkdir(resolve(process.cwd(), env.uploadDir), { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, resolve(process.cwd(), env.uploadDir)),
  filename: (req, file, callback) => callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    const extensions = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.docx']);
    if (!allowed.has(file.mimetype) || !extensions.has(extname(file.originalname).toLowerCase())) return callback(new HttpError(400, 'Tipo de archivo no permitido. Usa PDF, JPG, PNG o DOCX.'));
    callback(null, true);
  },
});
