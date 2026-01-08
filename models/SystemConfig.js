const mongoose = require('mongoose');

/**
 * Configuración Global del Sistema
 * Solo debe existir UN documento (singleton)
 * Solo administradores pueden modificar
 */
const SystemConfigSchema = new mongoose.Schema({
  // Logo de la empresa (JSON de Lottie)
  logoJson: { type: String, default: null },
  logoSize: { type: Number, default: 120 },
  
  // Información de la aplicación
  appName: { type: String, default: 'GestorImpresoras' },
  appVersion: { type: String, default: 'Enterprise v2.0' },
  companyName: { type: String, default: 'GestorImpresoras Enterprise' },
  
  // Footer
  footerText: { type: String, default: 'Sistemas e Infraestructura' },
  copyrightYear: { type: String, default: '2025' },
  copyrightCompany: { type: String, default: 'California S.A.' }
}, { timestamps: true });

/**
 * Obtener o crear la configuración del sistema (singleton)
 */
SystemConfigSchema.statics.getInstance = async function() {
  let config = await this.findOne();
  
  if (!config) {
    // Crear configuración por defecto si no existe
    config = await this.create({
      logoJson: null,
      logoSize: 120,
      appName: 'GestorImpresoras',
      appVersion: 'Enterprise v2.0',
      companyName: 'GestorImpresoras Enterprise',
      footerText: 'Sistemas e Infraestructura',
      copyrightYear: '2025',
      copyrightCompany: 'California S.A.'
    });
    console.log('✅ Configuración del sistema creada');
  }
  
  return config;
};

/**
 * Actualizar configuración del sistema
 */
SystemConfigSchema.statics.updateConfig = async function(updates) {
  let config = await this.getInstance();
  
  // Actualizar solo los campos proporcionados
  Object.keys(updates).forEach(key => {
    if (updates[key] !== undefined) {
      config[key] = updates[key];
    }
  });
  
  await config.save();
  return config;
};

module.exports = mongoose.model('SystemConfig', SystemConfigSchema);
