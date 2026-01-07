/**
 * CORS Configuration
 * Configuración de Cross-Origin Resource Sharing
 */

const corsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true // Permitir el envío de cookies
};

module.exports = corsOptions;
