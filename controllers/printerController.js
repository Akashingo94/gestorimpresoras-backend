/**
 * Printer Controller
 * Maneja CRUD de impresoras y sincronización SNMP
 */

const Printer = require('../models/Printer');
const MaintenanceLog = require('../models/Log');
const { addSystemLog } = require('../utils/logger');
const { 
  snmp, 
  resolveHostnameToIP, 
  detectColorFromDescription 
} = require('../services/snmpService');

/**
 * Lista todas las impresoras activas (no eliminadas)
 */
async function getAllPrinters(req, res) {
  try {
    // Buscar impresoras donde deleted es false O no existe (para compatibilidad)
    const printers = await Printer.find({ 
      $or: [
        { deleted: false },
        { deleted: { $exists: false } }
      ]
    }).sort({ location: 1 });
    
    // Limpiar niveles de tóner para impresoras monocromáticas antes de enviar
    const cleanedPrinters = printers.map(printer => {
      const printerObj = printer.toJSON();
      
      // Asegurar que el campo 'id' existe
      if (!printerObj.id && printerObj._id) {
        printerObj.id = printerObj._id.toString();
        delete printerObj._id;
      }
      
      // Detectar si es monocromática por modelo
      const isMonochrome = printerObj.model && (
        printerObj.model.includes('HL-L5') ||
        printerObj.model.includes('HL-5') ||
        printerObj.model.includes('DCP-L') ||
        printerObj.model.includes('MFC-L') ||
        printerObj.model.match(/HL-[0-9]/)
      );
      
      if (isMonochrome && printerObj.tonerLevels) {
        // Solo conservar el nivel de negro
        const blackLevel = printerObj.tonerLevels.black || 0;
        printerObj.tonerLevels = { black: blackLevel };
      }
      
      return printerObj;
    });
    
    res.json(cleanedPrinters);
  } catch (err) {
    addSystemLog('error', 'PRINTERS', 'Error al listar impresoras', err.message);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Crea una nueva impresora
 */
async function createPrinter(req, res) {
  try {
    const newPrinter = new Printer(req.body);
    const savedPrinter = await newPrinter.save();
    addSystemLog('success', 'API', `Impresora creada: ${req.body.model || 'Nueva impresora'}`, `IP: ${req.body.ipAddress}, Usuario: ${req.session.username}`);
    res.status(201).json(savedPrinter);
  } catch (err) {
    addSystemLog('error', 'PRINTERS', 'Error al crear impresora', err.message);
    res.status(400).json({ error: err.message });
  }
}

/**
 * Actualiza una impresora existente
 */
async function updatePrinter(req, res) {
  const { id } = req.params;
  
  try {
    const updatedPrinter = await Printer.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true }
    );
    
    if (!updatedPrinter) {
      return res.status(404).json({ error: 'Printer not found' });
    }
    
    let printerResponse = updatedPrinter.toJSON();
    
    // Asegurar campo 'id'
    if (!printerResponse.id && printerResponse._id) {
      printerResponse.id = printerResponse._id.toString();
      delete printerResponse._id;
    }
    
    // Limpiar colores de impresoras monocromáticas
    const isMonochrome = printerResponse.model && (
      printerResponse.model.includes('HL-L5') ||
      printerResponse.model.includes('HL-5') ||
      printerResponse.model.includes('DCP-L') ||
      printerResponse.model.includes('MFC-L') ||
      /HL-\d/.test(printerResponse.model)
    );
    
    if (isMonochrome && printerResponse.tonerLevels) {
      const blackLevel = printerResponse.tonerLevels.black || printerResponse.tonerLevels.get?.('black') || 0;
      printerResponse.tonerLevels = { black: blackLevel };
    }
    
    addSystemLog('info', 'API', `Impresora actualizada: ${printerResponse.model}`, `IP: ${printerResponse.ipAddress}, Usuario: ${req.session.username}`);
    
    res.json(printerResponse);
  } catch (err) {
    addSystemLog('error', 'PRINTERS', 'Error al actualizar impresora', err.message);
    res.status(400).json({ error: err.message });
  }
}

/**
 * Elimina una impresora
 */
/**
 * Elimina una impresora (soft delete - archivado)
 */
async function deletePrinter(req, res) {
  const { id } = req.params;
  const { reason } = req.body;
  
  try {
    const printer = await Printer.findOne({ 
      _id: id,
      $or: [
        { deleted: false },
        { deleted: { $exists: false } }
      ]
    });
    if (!printer) {
      return res.status(404).json({ error: 'Impresora no encontrada' });
    }
    
    // Validar que se proporcione un motivo
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Se requiere un motivo para eliminar la impresora' });
    }
    
    // Soft delete: marcar como eliminada en lugar de borrar
    printer.deleted = true;
    printer.deletedAt = new Date();
    printer.deletedBy = req.session.userId;
    printer.deletionReason = reason.trim();
    await printer.save();
    
    addSystemLog('warn', 'PRINTER_DELETED', 
      `Impresora archivada: ${printer.model || 'Desconocida'}`, 
      `IP: ${printer.ipAddress || 'N/A'} | Ubicación: ${printer.location || 'N/A'} | Usuario: ${req.session.username} | Motivo: ${reason}`
    );
    
    res.json({ 
      message: 'Impresora archivada correctamente',
      printer: {
        id: printer._id,
        model: printer.model,
        location: printer.location,
        deletedAt: printer.deletedAt
      }
    });
  } catch (err) {
    addSystemLog('error', 'PRINTERS', 'Error al archivar impresora', err.message);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Lista impresoras archivadas (solo admins)
 */
async function getArchivedPrinters(req, res) {
  try {
    const archived = await Printer.find({ deleted: true })
      .populate('deletedBy', 'username email')
      .sort({ deletedAt: -1 });
    
    const cleanedArchived = archived.map(printer => {
      const printerObj = printer.toJSON();
      if (!printerObj.id && printerObj._id) {
        printerObj.id = printerObj._id.toString();
        delete printerObj._id;
      }
      return printerObj;
    });
    
    res.json(cleanedArchived);
  } catch (err) {
    addSystemLog('error', 'PRINTERS', 'Error al listar impresoras archivadas', err.message);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Restaura una impresora archivada (solo admins)
 */
async function restorePrinter(req, res) {
  const { id } = req.params;
  
  try {
    const printer = await Printer.findOne({ _id: id, deleted: true });
    if (!printer) {
      return res.status(404).json({ error: 'Impresora archivada no encontrada' });
    }
    
    printer.deleted = false;
    printer.deletedAt = null;
    printer.deletedBy = null;
    printer.deletionReason = null;
    await printer.save();
    
    addSystemLog('success', 'PRINTER_RESTORED', 
      `Impresora restaurada: ${printer.model || 'Desconocida'}`, 
      `IP: ${printer.ipAddress || 'N/A'} | Ubicación: ${printer.location || 'N/A'} | Usuario: ${req.session.username}`
    );
    
    res.json({ 
      message: 'Impresora restaurada correctamente',
      printer: printer.toJSON()
    });
  } catch (err) {
    addSystemLog('error', 'PRINTERS', 'Error al restaurar impresora', err.message);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Sincroniza impresora vía SNMP
 * NOTA: Esta función es muy larga y compleja, se mantiene aquí por ahora
 * TODO: Refactorizar en funciones más pequeñas
 */
async function syncPrinter(req, res, { mockSnmpQuery }) {
  let { id, ip, brand, community = 'public' } = req.body;
  let originalIP = ip;
  let ipWasUpdated = false;
  
  let session = snmp.createSession(ip, community, {
    timeout: 3000,
    retries: 2,
    version: snmp.Version2c
  });
  
  try {
    let previousPrinter = null;
    if (id) {
      previousPrinter = await Printer.findById(id);
    }
    
    let hardwareData;
    try {
      hardwareData = await mockSnmpQuery(session, ip, brand, community);
    } catch (snmpError) {
      console.log(`⚠️ Fallo inicial de SNMP en IP ${ip}`);
      addSystemLog('warn', 'PRINTER_SYNC', `Error SNMP en IP ${ip}`, `Intentando resolución automática de hostname`);
      
      // Intentar obtener hostname de múltiples fuentes
      const hostname = previousPrinter?.hostname || req.body.hostname;
      
      if (hostname && hostname.trim() !== '') {
        console.log(`🔄 Intentando resolver hostname "${hostname}"...`);
        addSystemLog('info', 'PRINTER_SYNC', `Resolviendo hostname: ${hostname}`, `IP original: ${ip}`);
        
        try {
          const resolvedIP = await resolveHostnameToIP(hostname);
          
          if (resolvedIP && resolvedIP !== ip) {
            console.log(`📍 Nueva IP detectada: ${ip} -> ${resolvedIP}`);
            addSystemLog('success', 'PRINTER_SYNC', 
              `IP actualizada automáticamente`, 
              `Hostname: ${hostname} | IP anterior: ${ip} | Nueva IP: ${resolvedIP}`
            );
            
            // Cerrar sesión anterior y crear nueva con la IP resuelta
            session.close();
            session = snmp.createSession(resolvedIP, community, {
              timeout: 3000,
              retries: 2,
              version: snmp.Version2c
            });
            
            // Actualizar IP en base de datos si existe el registro
            if (id) {
              await Printer.findByIdAndUpdate(id, { $set: { ipAddress: resolvedIP } });
            }
            
            ip = resolvedIP;
            ipWasUpdated = true;
            
            // Reintentar consulta SNMP con nueva IP
            hardwareData = await mockSnmpQuery(session, ip, brand, community);
            
          } else if (resolvedIP === ip) {
            // El hostname resuelve a la misma IP, el problema es otro
            console.log(`ℹ️ Hostname resuelve a la misma IP (${ip}), problema de SNMP o firewall`);
            addSystemLog('error', 'PRINTER_SYNC', 
              `Error SNMP pero IP correcta`, 
              `Hostname: ${hostname} | IP: ${ip} | Verificar firewall o comunidad SNMP`
            );
            throw snmpError;
          } else {
            // No se pudo resolver hostname
            console.log(`❌ No se pudo resolver hostname "${hostname}"`);
            addSystemLog('error', 'PRINTER_SYNC', 
              `Fallo resolución de hostname`, 
              `Hostname: ${hostname} | IP original: ${ip} | No se encontró en DNS`
            );
            throw snmpError;
          }
        } catch (dnsError) {
          console.error(`❌ Error al resolver hostname:`, dnsError.message);
          addSystemLog('error', 'PRINTER_SYNC', 
            `Error en resolución DNS`, 
            `Hostname: ${hostname} | IP: ${ip} | Error: ${dnsError.message}`
          );
          throw snmpError; // Lanzar el error SNMP original
        }
      } else {
        // No hay hostname configurado
        console.log(`❌ Sin hostname configurado para recuperación automática`);
        addSystemLog('error', 'PRINTER_SYNC', 
          `Error SNMP sin hostname`, 
          `IP: ${ip} | Configure un hostname para recuperación automática de IP`
        );
        throw snmpError;
      }
    }
    
    const updateData = {
      model: hardwareData.model,
      serialNumber: hardwareData.serial,
      firmwareVersion: hardwareData.firmware,
      tonerLevels: hardwareData.levels,
      status: hardwareData.status,
      currentErrors: hardwareData.errors,
      lastStatusUpdate: new Date(),
      cartridgeInfo: hardwareData.cartridgeInfo || {}
    };
    
    if (ipWasUpdated) {
      updateData.ipAddress = ip;
    }
    
    // Detectar y registrar cambios de tóner automáticamente
    await detectTonerChanges(previousPrinter, hardwareData, id);
    
    // Guardar en DB
    let updatedPrinter;
    if (id) {
      updatedPrinter = await Printer.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    } else {
      updatedPrinter = await Printer.findOneAndUpdate({ ipAddress: ip }, { $set: updateData }, { new: true, upsert: true });
    }
    
    let printerResponse = cleanPrinterResponse(updatedPrinter.toJSON());
    
    // Si la IP fue actualizada automáticamente, incluir información en la respuesta
    if (ipWasUpdated) {
      printerResponse.ipUpdated = true;
      printerResponse.previousIP = originalIP;
      printerResponse.message = `✅ IP actualizada automáticamente: ${originalIP} → ${ip}`;
      
      addSystemLog('success', 'PRINTER_SYNC', 
        `Sincronización exitosa con nueva IP`, 
        `Impresora: ${printerResponse.model || 'N/A'} | IP anterior: ${originalIP} | Nueva IP: ${ip}`
      );
    }
    
    res.json(printerResponse);
    
  } catch (err) {
    console.error(`❌ Error SNMP en ${ip}:`, err.message);
    if (id) {
      await Printer.findByIdAndUpdate(id, { status: 'OFFLINE' });
    }
    res.status(502).json({ error: 'No se pudo conectar a la impresora via SNMP' });
  } finally {
    session.close();
  }
}

/**
 * Obtiene información de suministros vía SNMP
 */
async function getPrinterSupplies(req, res, { mockSnmpQuery }) {
  const { ip, brand, community = 'public' } = req.body;
  const session = snmp.createSession(ip, community, {
    timeout: 3000,
    retries: 2,
    version: snmp.Version2c
  });
  
  try {
    const hardwareData = await mockSnmpQuery(session, ip, brand, community);
    
    await Printer.updateOne(
      { ipAddress: ip },
      {
        $set: {
          tonerLevels: hardwareData.levels,
          status: hardwareData.status,
          lastStatusUpdate: new Date()
        }
      }
    );
    
    res.json({
      levels: hardwareData.levels,
      status: hardwareData.status,
      errors: hardwareData.errors
    });
  } catch (err) {
    res.status(502).json({ error: 'Error consultando suministros' });
  } finally {
    session.close();
  }
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Detecta cambios en cartuchos de tóner y crea logs automáticos
 */
async function detectTonerChanges(previousPrinter, hardwareData, printerId) {
  if (!previousPrinter) return;
  
  // Detectar por serial/ID de cartucho
  if (previousPrinter.cartridgeInfo && hardwareData.cartridgeInfo) {
    const prevCartridges = previousPrinter.cartridgeInfo;
    const currentCartridges = hardwareData.cartridgeInfo;
    
    for (const cartridgeIndex of Object.keys(currentCartridges)) {
      const prevInfo = prevCartridges[cartridgeIndex];
      const currentInfo = currentCartridges[cartridgeIndex];
      
      if (prevInfo && currentInfo) {
        const prevSerial = prevInfo.serial || prevInfo.name || prevInfo.capacity;
        const currentSerial = currentInfo.serial || currentInfo.name || currentInfo.capacity;
        
        if (prevSerial && currentSerial && prevSerial !== currentSerial) {
          const cartridgeName = currentInfo.name || 'Unknown';
          const color = detectColorFromDescription(cartridgeName) || 'black';
          
          await createTonerChangeLog(printerId, color, cartridgeName, prevSerial, currentSerial);
        }
      }
    }
  }
  
  // Detectar por cambios de nivel (fallback)
  if (previousPrinter.tonerLevels && (!hardwareData.cartridgeInfo || Object.keys(hardwareData.cartridgeInfo).length === 0)) {
    const colors = ['black', 'cyan', 'magenta', 'yellow'];
    
    for (const color of colors) {
      const prevLevel = previousPrinter.tonerLevels[color];
      const currentLevel = hardwareData.levels[color];
      
      if (prevLevel !== undefined && currentLevel !== undefined) {
        const levelIncrease = currentLevel - prevLevel;
        
        if (levelIncrease > 50) {
          await createTonerChangeLevelLog(printerId, color, prevLevel, currentLevel);
        }
      }
    }
  }
}

/**
 * Crea log de mantenimiento por cambio de cartucho (serial)
 */
async function createTonerChangeLog(printerId, color, cartridgeName, prevSerial, currentSerial) {
  try {
    const maintenanceLog = new MaintenanceLog({
      printerId,
      type: 'Cambio de Tóner',
      description: `Cambio de cartucho ${color} detectado por SNMP`,
      performedBy: 'Sistema (SNMP Auto-detectado)',
      notes: `Detección por cambio de identificador del cartucho.\nCartucho: ${cartridgeName}\nID anterior: ${prevSerial}\nID nuevo: ${currentSerial}`,
      timestamp: new Date()
    });
    await maintenanceLog.save();
    await Printer.findByIdAndUpdate(printerId, { lastMaintenance: new Date() });
    console.log(`✅ Registro de mantenimiento creado: Cambio de cartucho ${color}`);
  } catch (error) {
    console.error(`⚠️ Error creando log: ${error.message}`);
  }
}

/**
 * Crea log de mantenimiento por cambio de nivel
 */
async function createTonerChangeLevelLog(printerId, color, prevLevel, currentLevel) {
  try {
    const maintenanceLog = new MaintenanceLog({
      printerId,
      type: 'Cambio de Tóner',
      description: `Cambio de tóner ${color} detectado automáticamente (nivel subió de ${prevLevel}% a ${currentLevel}%)`,
      performedBy: 'Sistema (Auto-detectado)',
      notes: `Detección automática mediante SNMP. Nivel anterior: ${prevLevel}%, nivel actual: ${currentLevel}%`,
      timestamp: new Date()
    });
    await maintenanceLog.save();
    await Printer.findByIdAndUpdate(printerId, { lastMaintenance: new Date() });
    console.log(`✅ Registro de mantenimiento creado para cambio de tóner ${color}`);
  } catch (error) {
    console.error(`⚠️ Error creando log: ${error.message}`);
  }
}

/**
 * Limpia respuesta de impresora para monocromáticas
 */
function cleanPrinterResponse(printerObj) {
  if (!printerObj.id && printerObj._id) {
    printerObj.id = printerObj._id.toString();
    delete printerObj._id;
  }
  
  if (printerObj.tonerLevels instanceof Map) {
    printerObj.tonerLevels = Object.fromEntries(printerObj.tonerLevels);
  }
  
  const isMonochrome = printerObj.model && (
    printerObj.model.includes('HL-L5') ||
    printerObj.model.includes('HL-5') ||
    printerObj.model.includes('DCP-L') ||
    printerObj.model.includes('MFC-L') ||
    printerObj.model.match(/HL-[0-9]/)
  );
  
  if (isMonochrome && printerObj.tonerLevels) {
    const blackLevel = printerObj.tonerLevels.black || 0;
    printerObj.tonerLevels = { black: blackLevel };
  }
  
  return printerObj;
}

module.exports = {
  getAllPrinters,
  createPrinter,
  updatePrinter,
  deletePrinter,
  getArchivedPrinters,
  restorePrinter,
  syncPrinter,
  getPrinterSupplies
};
