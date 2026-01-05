/**
 * Log Controller
 * Maneja registros de mantenimiento de impresoras
 */

const MaintenanceLog = require('../models/Log');
const Printer = require('../models/Printer');
const { addSystemLog } = require('../utils/logger');

/**
 * Lista todos los logs de mantenimiento
 * Puede filtrar por printerId si se proporciona en query
 */
async function getAllLogs(req, res) {
  try {
    const filter = req.query.printerId ? { printerId: req.query.printerId } : {};
    const logs = await MaintenanceLog.find(filter).sort({ timestamp: -1 });
    res.json(logs);
  } catch (err) {
    addSystemLog('error', 'LOGS', 'Error al listar logs de mantenimiento', err.message);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Crea un nuevo log de mantenimiento
 */
async function createLog(req, res) {
  try {
    const newLog = new MaintenanceLog(req.body);
    const savedLog = await newLog.save();
    
    // Actualizar lastMaintenance de la impresora
    if (req.body.printerId) {
      await Printer.findByIdAndUpdate(
        req.body.printerId,
        { lastMaintenance: new Date() }
      );
    }
    
    addSystemLog(
      'success',
      'LOGS',
      `Log de mantenimiento creado: ${req.body.type || 'Mantenimiento'}`,
      `Realizado por: ${req.body.performedBy || 'Usuario'}`
    );
    
    res.status(201).json(savedLog);
  } catch (err) {
    addSystemLog('error', 'LOGS', 'Error al crear log de mantenimiento', err.message);
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  getAllLogs,
  createLog
};
