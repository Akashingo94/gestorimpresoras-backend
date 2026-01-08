/**
 * System Configuration Routes
 * Rutas para configuración global del sistema
 */

const express = require('express');
const router = express.Router();
const systemConfigController = require('../controllers/systemConfigController');

/**
 * Factory function para crear el router con middleware
 */
module.exports = (context, middleware) => {
  const { requireAdmin, requireAuth } = middleware;

  // GET público (todos pueden ver la configuración)
  router.get('/', systemConfigController.getSystemConfig);
  
  // PUT solo para administradores
  router.put('/', requireAdmin, systemConfigController.updateSystemConfig);

  return router;
};
