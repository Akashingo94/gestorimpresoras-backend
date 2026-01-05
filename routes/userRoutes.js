/**
 * User Routes
 * Rutas de gestión de usuarios (solo admin)
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { 
  validateRejection, 
  validateRole,
  preventSelfDeletion,
  preventSelfRoleChange
} = require('../middleware/userValidation');

/**
 * Factory function para crear el router con contexto
 * @param {Object} context - Objeto con isMongoConnected, memUsers
 * @param {Object} middleware - Objeto con requireAdmin middleware
 */
module.exports = (context, middleware) => {
  const { requireAdmin, requireAuth } = middleware;
  const { upload } = require('../config/multer.config');

  router.get('/preset-avatars', requireAuth, userController.getPresetAvatars);
  router.put('/profile', requireAuth, upload.single('avatar'), userController.updateProfile);
  router.post('/change-password', requireAuth, userController.changePassword);
  router.get('/', requireAdmin, userController.getAllUsers);
  router.get('/pending', requireAdmin, userController.getPendingUsers);
  router.get('/rejected', requireAdmin, userController.getRejectedUsers);
  router.put('/:id/role', requireAdmin, preventSelfRoleChange, validateRole, userController.updateUserRole);
  router.post('/:id/reject', requireAdmin, validateRejection, userController.rejectPendingUser);
  router.delete('/:id', requireAdmin, preventSelfDeletion, userController.deleteUser);
  router.post('/:id/restore', requireAdmin, userController.restoreUser);

  return router;
};
