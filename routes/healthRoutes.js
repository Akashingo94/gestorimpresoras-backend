/**
 * Health Routes
 * Endpoints de estado del servidor
 */

const express = require('express');
const { getLocalIp } = require('../utils/network');

module.exports = function createHealthRoutes(appConfig) {
  const router = express.Router();

  // GET / - Mensaje de bienvenida
  router.get('/', (req, res) => {
    res.send(`GestorImpresoras Backend is RUNNING on port ${appConfig.port}`);
  });

  // GET /api/health - Health check
  router.get('/health', (req, res) => {
    res.json({ 
      status: 'OK', 
      service: 'GestorImpresoras Backend', 
      port: appConfig.port,
      ip: getLocalIp(),
      timestamp: new Date().toISOString()
    });
  });

  return router;
};
