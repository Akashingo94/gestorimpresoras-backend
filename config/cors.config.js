/**
 * CORS Configuration
 * Configuración de Cross-Origin Resource Sharing
 * Permite acceso desde localhost y dominio local personalizado
 */

const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://gestorimpresoras.local:3000',
    'http://127.0.0.1:3000',
    'http://172.25.84.55:3000', // IP de red local
    '*' // Permitir todos en desarrollo (cambiar en producción)
  ],
  credentials: true, // Permitir el envío de cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie']
};

module.exports = corsOptions;
