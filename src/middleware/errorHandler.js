class AppError extends Error {
  constructor(statusCode, message, code, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || `HTTP_${statusCode}`;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Route not found' });
}

function errorHandler(err, req, res, next) {
  if (err.isOperational) {
    const body = { error: err.message, code: err.code };
    if (err.details) body.details = err.details;
    return res.status(err.statusCode).json(body);
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body', code: 'BAD_JSON' });
  }

  if (err.code && String(err.code).startsWith('SQLITE')) {
    return res.status(500).json({ error: 'Database error', code: 'DB_ERROR' });
  }

  const msg = err.message || '';
  if (typeof msg === 'string' && msg.includes('UNIQUE constraint failed')) {
    return res.status(409).json({ error: 'Resource already exists', code: 'CONFLICT' });
  }
  if (typeof msg === 'string' && msg.includes('FOREIGN KEY constraint failed')) {
    return res.status(400).json({ error: 'Referenced resource does not exist', code: 'FOREIGN_KEY' });
  }

  console.error('[UnhandledError]', err);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL' });
}

module.exports = { AppError, notFoundHandler, errorHandler };
