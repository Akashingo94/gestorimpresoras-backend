/**
 * Network Routes
 * Rutas de escaneo de red para auto-descubrimiento de impresoras
 */

const express = require('express');
const router = express.Router();
const networkController = require('../controllers/networkController');

/**
 * Factory function para crear el router con contexto
 * @param {Object} middleware - Objeto con requireAdmin
 */
module.exports = (middleware) => {
  const { requireAdmin } = middleware;

  // POST /api/network/scan - Escanear red en busca de impresoras (admin only)
  router.post('/scan', requireAdmin, networkController.scanNetwork);

  return router;
};
