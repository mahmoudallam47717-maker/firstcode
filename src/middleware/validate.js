const { z } = require('zod');
const { AppError } = require('./errorHandler');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return next(new AppError(400, 'Validation failed', 'VALIDATION_ERROR', details));
    }
    req[source] = result.data;
    return next();
  };
}

module.exports = { validate };
