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
  lastStatusUpdate: Date
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
  // Intentar buscar por IP primero
  let printer = await this.findOne({ ipAddress: identifier });
  
  // Si no se encuentra y parece un ObjectId, buscar por ID
  if (!printer && mongoose.Types.ObjectId.isValid(identifier)) {
    printer = await this.findById(identifier);
  }
  
  return printer;
};

module.exports = mongoose.model('Printer', PrinterSchema);
