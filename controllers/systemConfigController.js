const SystemConfig = require('../models/SystemConfig');
const { addSystemLog } = require('../utils/logger');

/**
 * Obtener configuración del sistema (público - todos pueden ver)
 */
async function getSystemConfig(req, res) {
  try {
    const config = await SystemConfig.getInstance();
    
    res.json({
      success: true,
      config: {
        logoJson: config.logoJson,
        logoSize: config.logoSize,
        appName: config.appName,
        appVersion: config.appVersion,
        companyName: config.companyName,
        footerText: config.footerText,
        copyrightYear: config.copyrightYear,
        copyrightCompany: config.copyrightCompany
      }
    });
  } catch (err) {
    addSystemLog('error', 'SYSTEM', 'Error al obtener configuración del sistema', err.message);
    res.status(500).json({ error: 'Error en el servidor' });
  }
}

/**
 * Actualizar configuración del sistema (solo ADMIN)
 */
async function updateSystemConfig(req, res) {
  try {
    const updates = req.body;
    
    // Validar que no se envíen campos no permitidos
    const allowedFields = ['logoJson', 'logoSize', 'appName', 'appVersion', 'companyName', 'footerText', 'copyrightYear', 'copyrightCompany'];
    const invalidFields = Object.keys(updates).filter(key => !allowedFields.includes(key));
    
    if (invalidFields.length > 0) {
      return res.status(400).json({ 
        error: 'Campos no permitidos',
        invalidFields 
      });
    }
    
    const config = await SystemConfig.updateConfig(updates);
    
    // Registrar cambios en log
    const changedFields = Object.keys(updates).join(', ');
    addSystemLog('info', 'SYSTEM', `Configuración del sistema actualizada por ${req.session.user?.username || 'admin'}`, `Campos modificados: ${changedFields}`);
    
    res.json({
      success: true,
      message: 'Configuración actualizada correctamente',
      config: {
        logoJson: config.logoJson,
        logoSize: config.logoSize,
        appName: config.appName,
        appVersion: config.appVersion,
        companyName: config.companyName,
        footerText: config.footerText,
        copyrightYear: config.copyrightYear,
        copyrightCompany: config.copyrightCompany
      }
    });
  } catch (err) {
    addSystemLog('error', 'SYSTEM', 'Error al actualizar configuración del sistema', err.message);
    res.status(500).json({ error: 'Error en el servidor' });
  }
}

module.exports = {
  getSystemConfig,
  updateSystemConfig
};
