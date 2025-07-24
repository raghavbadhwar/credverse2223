/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Default error response
  let error = {
    message: err.message || 'Internal Server Error',
    status: err.status || 500,
    code: err.code || 'INTERNAL_ERROR'
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    error = {
      message: 'Validation Error',
      status: 400,
      code: 'VALIDATION_ERROR',
      details: err.details || err.message
    };
  }

  if (err.name === 'CastError') {
    error = {
      message: 'Invalid ID format',
      status: 400,
      code: 'INVALID_ID'
    };
  }

  if (err.code === 11000) {
    error = {
      message: 'Duplicate field value',
      status: 400,
      code: 'DUPLICATE_VALUE',
      field: Object.keys(err.keyValue)[0]
    };
  }

  if (err.name === 'JsonWebTokenError') {
    error = {
      message: 'Invalid token',
      status: 401,
      code: 'INVALID_TOKEN'
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      message: 'Token expired',
      status: 401,
      code: 'TOKEN_EXPIRED'
    };
  }

  // Web3/Blockchain errors
  if (err.message?.includes('revert')) {
    error = {
      message: 'Smart contract transaction failed',
      status: 400,
      code: 'CONTRACT_ERROR',
      details: err.message
    };
  }

  // IPFS errors
  if (err.message?.includes('IPFS')) {
    error = {
      message: 'IPFS operation failed',
      status: 503,
      code: 'IPFS_ERROR',
      details: err.message
    };
  }

  // Database errors
  if (err.message?.includes('database') || err.message?.includes('connection')) {
    error = {
      message: 'Database operation failed',
      status: 503,
      code: 'DATABASE_ERROR'
    };
  }

  // Don't expose sensitive error details in production
  if (process.env.NODE_ENV === 'production') {
    if (error.status >= 500) {
      error.message = 'Internal Server Error';
      delete error.details;
      delete error.stack;
    }
  } else {
    // Include stack trace in development
    error.stack = err.stack;
  }

  res.status(error.status).json({
    success: false,
    error: error.message,
    code: error.code,
    ...(error.details && { details: error.details }),
    ...(error.field && { field: error.field }),
    ...(error.stack && { stack: error.stack }),
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  });
};

module.exports = errorHandler;