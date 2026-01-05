/**
 * Printer Routes
 * Rutas de gestión de impresoras y sincronización SNMP
 */

const express = require('express');
const router = express.Router();
const printerController = require('../controllers/printerController');

/**
 * Factory function para crear el router con contexto
 * @param {Object} context - Objeto con isMongoConnected, memPrinters, generateId, mockSnmpQuery
 * @param {Object} middleware - Objeto con authMiddleware, requireAdmin
 */
module.exports = (context, middleware) => {
  const { authMiddleware, requireAdmin } = middleware;

  // GET /api/printers - Listar todas las impresoras
  router.get('/', authMiddleware, printerController.getAllPrinters);

  // POST /api/printers - Crear nueva impresora
  router.post('/', authMiddleware, printerController.createPrinter);

  // PUT /api/printers/:id - Actualizar impresora
  router.put('/:id', authMiddleware, printerController.updatePrinter);

  // DELETE /api/printers/:id - Eliminar impresora (admin only)
  router.delete('/:id', requireAdmin, printerController.deletePrinter);

  // POST /api/printer/sync - Sincronizar impresora vía SNMP
  router.post('/sync', authMiddleware, (req, res) => 
    printerController.syncPrinter(req, res, { mockSnmpQuery: context.mockSnmpQuery })
  );

  // POST /api/printer/supplies - Obtener niveles de tóner vía SNMP
  router.post('/supplies', (req, res) => 
    printerController.getPrinterSupplies(req, res, { mockSnmpQuery: context.mockSnmpQuery })
  );

  return router;
};
