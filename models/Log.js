const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
  printerId: { type: String, required: true },
  type: { type: String, enum: ['TONER_REPLACEMENT', 'REPAIR', 'CHECKUP'], required: true },
  description: String,
  timestamp: { type: Date, default: Date.now },
  technician: String
}, { timestamps: true });

LogSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
  }
});

/**
 * Obtiene logs de una impresora específica
 * @param {string} printerId - ID de la impresora
 * @param {number} limit - Límite de registros (default: 100)
 * @returns {Promise<Array>}
 */
LogSchema.statics.getByPrinter = async function(printerId, limit = 100) {
  return this.find({ printerId })
    .sort({ timestamp: -1 })
    .limit(limit);
};

/**
 * Obtiene logs recientes del sistema
 * @param {number} limit - Límite de registros (default: 50)
 * @returns {Promise<Array>}
 */
LogSchema.statics.getRecent = async function(limit = 50) {
  return this.find()
    .sort({ timestamp: -1 })
    .limit(limit);
};

module.exports = mongoose.model('MaintenanceLog', LogSchema);
