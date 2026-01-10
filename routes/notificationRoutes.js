/**
 * Notification Routes
 * Rutas para gestión de notificaciones de usuario
 */

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

module.exports = (middleware) => {
  const { authMiddleware } = middleware;

  // GET /api/notifications - Obtener notificaciones del usuario
  router.get('/', authMiddleware, notificationController.getNotifications);

  // GET /api/notifications/unread-count - Obtener conteo de no leídas
  router.get('/unread-count', authMiddleware, notificationController.getUnreadCount);

  // POST /api/notifications - Crear nueva notificación
  router.post('/', authMiddleware, notificationController.createNotification);

  // PUT /api/notifications/:id/read - Marcar como leída
  router.put('/:id/read', authMiddleware, notificationController.markAsRead);

  // PUT /api/notifications/read-all - Marcar todas como leídas
  router.put('/read-all', authMiddleware, notificationController.markAllAsRead);

  // DELETE /api/notifications/:id - Eliminar notificación
  router.delete('/:id', authMiddleware, notificationController.deleteNotification);

  // DELETE /api/notifications - Eliminar todas las notificaciones
  router.delete('/', authMiddleware, notificationController.deleteAllNotifications);

  return router;
};
