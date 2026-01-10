const mongoose = require('mongoose');

const PrinterSchema = new mongoose.Schema({
  ipAddress: { type: String, required: true, unique: true },
  hostname: String,
  brand: String,
  model: String,
  location: String,
  serialNumber: String,
  firmwareVersion: String,
  status: { type: String, enum: ['ONLINE', 'WARNING', 'ERROR', 'OFFLINE'], default: 'ONLINE' },
  tonerLevels: { type: Map, of: Number }, 
  cartridgeInfo: { type: Map, of: mongoose.Schema.Types.Mixed },  // Información de cartuchos (serial, ID, etc.)
  currentErrors: [String],
  imageUrl: String,
  imagePosition: String,
  driver: Object,
  firmwareFile: Object,
  lastMaintenance: Date,
  lastStatusUpdate: Date,
  // Soft delete fields
  deleted: { type: Boolean, default: false },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deletionReason: String
}, { timestamps: true });

PrinterSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) { 
    ret.id = ret._id;
    delete ret._id; 
  }
});

/**
 * Encuentra una impresora por IP o ID
 * @param {string} identifier - IP address o MongoDB ID
 * @returns {Promise<Printer|null>}
 */
PrinterSchema.statics.findByIpOrId = async function(identifier) {
  // Intentar buscar por IP primero (solo activas)
  let printer = await this.findOne({ ipAddress: identifier, deleted: false });
  
  // Si no se encuentra y parece un ObjectId, buscar por ID
  if (!printer && mongoose.Types.ObjectId.isValid(identifier)) {
    printer = await this.findOne({ _id: identifier, deleted: false });
  }
  
  return printer;
};

/**
 * Encuentra todas las impresoras activas (no eliminadas)
 */
PrinterSchema.statics.findActive = function(query = {}) {
  return this.find({ ...query, deleted: false });
};

/**
 * Encuentra todas las impresoras archivadas (eliminadas)
 */
PrinterSchema.statics.findArchived = function(query = {}) {
  return this.find({ ...query, deleted: true });
};

module.exports = mongoose.model('Printer', PrinterSchema);
