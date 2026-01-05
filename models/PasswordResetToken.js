/**
 * Password Reset Token Model
 * Modelo para tokens de recuperación de contraseña
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const PasswordResetTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => Date.now() + 3600000, // 1 hora
    index: { expires: 0 } // TTL index para auto-eliminar tokens expirados
  },
  used: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

/**
 * Genera un token seguro de recuperación
 */
PasswordResetTokenSchema.statics.generateToken = function() {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Crea un nuevo token de recuperación para un usuario
 */
PasswordResetTokenSchema.statics.createForUser = async function(userId) {
  // Invalidar tokens anteriores
  await this.updateMany(
    { userId, used: false },
    { used: true }
  );
  
  const token = this.generateToken();
  const resetToken = await this.create({
    userId,
    token,
    expiresAt: Date.now() + 3600000 // 1 hora
  });
  
  return resetToken;
};

/**
 * Verifica si un token es válido
 */
PasswordResetTokenSchema.statics.validateToken = async function(token) {
  const resetToken = await this.findOne({
    token,
    used: false,
    expiresAt: { $gt: Date.now() }
  }).populate('userId');
  
  return resetToken;
};

module.exports = mongoose.model('PasswordResetToken', PasswordResetTokenSchema);
