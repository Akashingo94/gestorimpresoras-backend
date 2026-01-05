/**
 * System Log Routes
 * Rutas de logs del sistema (streaming, historial)
 */

const express = require('express');
const router = express.Router();
const systemLogController = require('../controllers/systemLogController');

/**
 * Factory function para crear el router con contexto
 * @param {Object} middleware - Objeto con requireAuth, requireAdmin
 */
module.exports = (middleware) => {
  const { requireAuth, requireAdmin } = middleware;

  // GET /api/logs/stream - Stream de logs en tiempo real (SSE) - Solo ADMIN
  router.get('/stream', requireAdmin, systemLogController.streamLogs);

  // GET /api/logs/history - Obtener historial de logs - Solo ADMIN
  router.get('/history', requireAdmin, systemLogController.getLogsHistory);

  // POST /api/logs/clear - Limpiar todos los logs (admin only)
  router.post('/clear', requireAdmin, systemLogController.clearLogs);

  return router;
};
