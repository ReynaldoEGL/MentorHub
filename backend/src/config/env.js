import dotenv from 'dotenv';
dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === 'true',
  jwtSecret: process.env.JWT_SECRET || 'local-development-secret-change-before-deploy',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  frontendUrls: (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map((v) => v.trim()),
  timezone: process.env.APP_TIMEZONE || 'America/Mexico_City',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
};

if (env.nodeEnv === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción.');
}
if (!env.databaseUrl) {
  console.warn('DATABASE_URL no está configurada. La API no podrá consultar PostgreSQL.');
}
