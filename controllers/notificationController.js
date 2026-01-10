/**
 * Notification Controller
 * Gestión de notificaciones de usuario
 */

const Notification = require('../models/Notification');

/**
 * Obtener todas las notificaciones del usuario actual
 */
async function getNotifications(req, res) {
  try {
    const notifications = await Notification.find({ userId: req.session.userId })
      .sort({ createdAt: -1 })
      .limit(100); // Últimas 100 notificaciones
    
    res.json(notifications);
  } catch (error) {
    console.error('Error obteniendo notificaciones:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Crear una nueva notificación
 */
async function createNotification(req, res) {
  try {
    const { title, message, type, printerId } = req.body;
    
    const notification = new Notification({
      userId: req.session.userId,
      title,
      message,
      type: type || 'info',
      printerId: printerId || null,
      read: false
    });
    
    await notification.save();
    res.status(201).json(notification);
  } catch (error) {
    console.error('Error creando notificación:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Marcar notificación como leída
 */
async function markAsRead(req, res) {
  try {
    const { id } = req.params;
    
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.session.userId },
      { read: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }
    
    res.json(notification);
  } catch (error) {
    console.error('Error marcando notificación:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Marcar todas las notificaciones como leídas
 */
async function markAllAsRead(req, res) {
  try {
    const result = await Notification.updateMany(
      { userId: req.session.userId, read: false },
      { read: true }
    );
    
    res.json({ 
      message: 'Todas las notificaciones marcadas como leídas',
      modifiedCount: result.modifiedCount 
    });
  } catch (error) {
    console.error('Error marcando todas como leídas:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Eliminar una notificación
 */
async function deleteNotification(req, res) {
  try {
    const { id } = req.params;
    
    const notification = await Notification.findOneAndDelete({
      _id: id,
      userId: req.session.userId
    });
    
    if (!notification) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }
    
    res.json({ message: 'Notificación eliminada' });
  } catch (error) {
    console.error('Error eliminando notificación:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Eliminar todas las notificaciones del usuario
 */
async function deleteAllNotifications(req, res) {
  try {
    const result = await Notification.deleteMany({ userId: req.session.userId });
    
    res.json({ 
      message: 'Todas las notificaciones eliminadas',
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error('Error eliminando todas las notificaciones:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Obtener conteo de notificaciones no leídas
 */
async function getUnreadCount(req, res) {
  try {
    const count = await Notification.countDocuments({
      userId: req.session.userId,
      read: false
    });
    
    res.json({ count });
  } catch (error) {
    console.error('Error obteniendo conteo:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  getUnreadCount
};
