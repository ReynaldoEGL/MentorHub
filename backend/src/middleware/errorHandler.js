export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.status || (error.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  if (status >= 500) console.error(error);
  const message = error.code === 'LIMIT_FILE_SIZE'
    ? 'El archivo supera el límite de 10 MB.'
    : status === 500 ? 'Ocurrió un error interno. Intenta nuevamente.' : error.message;
  res.status(status).json({ message });
}
