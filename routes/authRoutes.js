/**
 * Auth Routes
 * Rutas de autenticación y registro de usuarios
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { 
  validateLogin, 
  validateRegistration, 
  validatePasswordResetRequest,
  validatePasswordReset,
  validatePasswordChange
} = require('../middleware/validation');

/**
 * Factory function para crear el router con contexto
 * @param {Object} context - Objeto con isMongoConnected, memUsers
 * @param {Object} middleware - Objeto con attachUser, requireAuth, requireAdmin
 */
module.exports = (context, middleware) => {
  const { attachUser, requireAuth, requireAdmin } = middleware;

  // GET /api/auth/me - Obtener usuario actual
  router.get('/me', attachUser, authController.getCurrentUser);

  // POST /api/auth/login - Iniciar sesión
  router.post('/login', validateLogin, authController.login);

  // POST /api/auth/logout - Cerrar sesión
  router.post('/logout', authController.logout);

  // POST /api/auth/register - Registrar nuevo usuario
  router.post('/register', validateRegistration, authController.register);

  // POST /api/auth/forgot-password - Solicitar recuperación de contraseña
  router.post('/forgot-password', validatePasswordResetRequest, authController.forgotPassword);

  // GET /api/auth/verify-reset-token/:token - Verificar validez de token
  router.get('/verify-reset-token/:token', authController.verifyResetToken);

  // POST /api/auth/reset-password - Restablecer contraseña con token
  router.post('/reset-password', validatePasswordReset, authController.resetPassword);

  // POST /api/auth/change-password - Cambiar contraseña (requiere autenticación)
  router.post('/change-password', attachUser, requireAuth, validatePasswordChange, authController.changePassword);

  // POST /api/auth/send-password-recovery - Admin envía email de recuperación a usuario (admin only)
  router.post('/send-password-recovery', attachUser, requireAuth, requireAdmin, authController.sendPasswordRecovery);

  return router;
};
