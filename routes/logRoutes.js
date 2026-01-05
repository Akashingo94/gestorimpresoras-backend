/**
 * Log Routes
 * Rutas de logs de mantenimiento de impresoras
 */

const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');

/**
 * Factory function para crear el router con contexto
 * @param {Object} context - Objeto con isMongoConnected, memLogs, generateId
 * @param {Object} middleware - Objeto con authMiddleware
 */
module.exports = (context, middleware) => {
  const { authMiddleware } = middleware;

  // GET /api/logs - Listar logs de mantenimiento
  router.get('/', authMiddleware, logController.getAllLogs);

  // POST /api/logs - Crear nuevo log de mantenimiento
  router.post('/', authMiddleware, logController.createLog);

  return router;
};
