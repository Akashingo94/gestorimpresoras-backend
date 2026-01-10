/**
 * User Session Model
 * Guarda el estado de la sesión del usuario (vista actual, filtros, etc.)
 */

const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  // Estado de la UI
  selectedPrinterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Printer',
    default: null
  },
  searchTerm: {
    type: String,
    default: ''
  },
  // Preferencias de vista
  viewPreferences: {
    showNetworkScanner: { type: Boolean, default: false },
    showSystemLogs: { type: Boolean, default: false },
    isMobileSidebarOpen: { type: Boolean, default: false }
  },
  // Última actividad
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Actualizar lastActivity automáticamente
userSessionSchema.pre('save', function(next) {
  this.lastActivity = new Date();
  next();
});

// Limpiar sesiones inactivas (más de 7 días)
userSessionSchema.statics.cleanupInactiveSessions = async function() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const result = await this.deleteMany({ 
    lastActivity: { $lt: sevenDaysAgo }
  });
  console.log(`🗑️ Limpiadas ${result.deletedCount} sesiones inactivas`);
  return result;
};

module.exports = mongoose.model('UserSession', userSessionSchema);
