/**
 * Notification Model
 * Sistema de notificaciones persistentes por usuario
 */

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['info', 'alert', 'error', 'success'],
    default: 'info'
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  printerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Printer'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Índice compuesto para consultas eficientes
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

// Limpiar notificaciones antiguas (más de 30 días)
notificationSchema.statics.cleanupOldNotifications = async function() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const result = await this.deleteMany({ 
    createdAt: { $lt: thirtyDaysAgo },
    read: true 
  });
  console.log(`🗑️ Limpiadas ${result.deletedCount} notificaciones antiguas`);
  return result;
};

module.exports = mongoose.model('Notification', notificationSchema);
