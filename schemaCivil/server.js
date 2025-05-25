// Load environment variables early
require('dotenv').config();

const http = require('http');
const app = require('./app');
const logger = require('./config/logger');

// Validate essential environment variables
const requiredEnv = ['PORT', 'NODE_ENV'];
const missingEnv = requiredEnv.filter(env => !process.env[env]);

if (missingEnv.length) {
  logger.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

// Normalize and set port
const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

// Create and start server
const server = http.createServer(app);

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
});

// ------------------
// Helper Functions
// ------------------

function normalizePort(val) {
  const port = parseInt(val, 10);
  if (isNaN(port)) return val;
  if (port >= 0) return port;
  return false;
}

function onError(error) {
  if (error.syscall !== 'listen') throw error;

  const bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`;

  switch (error.code) {
    case 'EACCES':
      logger.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;

    case 'EADDRINUSE':
      logger.error(`${bind} is already in use`);
      process.exit(1);
      break;

    default:
      throw error;
  }
}

function onListening() {
  const addr = server.address();
  const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
  logger.info(`Server running on ${bind} in ${process.env.NODE_ENV} mode`);
}