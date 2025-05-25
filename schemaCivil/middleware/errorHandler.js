// Express error handling middleware
function errorHandler(err, req, res) {
  // Log the error
  console.error(err);

  // Customize response based on error type or status
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}

module.exports = errorHandler;