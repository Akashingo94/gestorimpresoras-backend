/**
 * Session Routes
 * Rutas para gestión del estado de sesión del usuario
 */

const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');

module.exports = (middleware) => {
  const { authMiddleware } = middleware;

  // GET /api/session - Obtener estado de sesión del usuario
  router.get('/', authMiddleware, sessionController.getSession);

  // PUT /api/session - Actualizar estado de sesión
  router.put('/', authMiddleware, sessionController.updateSession);

  // DELETE /api/session - Limpiar sesión
  router.delete('/', authMiddleware, sessionController.clearSession);

  return router;
};
