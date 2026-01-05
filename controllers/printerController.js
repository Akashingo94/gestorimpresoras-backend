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
 * Lista todas las impresoras
 */
async function getAllPrinters(req, res) {
  try {
    const printers = await Printer.find().sort({ location: 1 });
    
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
async function deletePrinter(req, res) {
  const { id } = req.params;
  
  try {
    const printer = await Printer.findById(id);
    if (!printer) {
      return res.status(404).json({ error: 'Printer not found' });
    }
    
    await Printer.findByIdAndDelete(id);
    await MaintenanceLog.deleteMany({ printerId: id });
    
    addSystemLog('warn', 'API', `Impresora eliminada: ${printer.model || 'Desconocida'}`, `IP: ${printer.ipAddress || 'N/A'}, Usuario: ${req.session.username}`);
    res.json({ message: 'Deleted' });
  } catch (err) {
    addSystemLog('error', 'PRINTERS', 'Error al eliminar impresora', err.message);
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
      
      const hostname = previousPrinter?.hostname || req.body.hostname;
      if (hostname && hostname.trim() !== '') {
        console.log(`🔄 Intentando resolver hostname "${hostname}"...`);
        
        const resolvedIP = await resolveHostnameToIP(hostname);
        
        if (resolvedIP && resolvedIP !== ip) {
          console.log(`📍 Nueva IP detectada: ${ip} -> ${resolvedIP}`);
          
          session.close();
          session = snmp.createSession(resolvedIP, community, {
            timeout: 3000,
            retries: 2,
            version: snmp.Version2c
          });
          
          if (id) {
            await Printer.findByIdAndUpdate(id, { $set: { ipAddress: resolvedIP } });
          }
          
          ip = resolvedIP;
          ipWasUpdated = true;
          hardwareData = await mockSnmpQuery(session, ip, brand, community);
        } else {
          throw snmpError;
        }
      } else {
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
  syncPrinter,
  getPrinterSupplies
};
