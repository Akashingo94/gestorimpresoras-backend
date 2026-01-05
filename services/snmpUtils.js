function cleanPrinterModel(rawModel, brand) {
  if (!rawModel) return `${brand} Printer`;
  
  if (/NC-\d+h/i.test(rawModel)) {
    console.log(`   ⚠️ Servidor de red detectado: ${rawModel} - será resuelto por parser Brother`);
    return rawModel;
  }
  
  let cleaned = rawModel
    .replace(/\s+[vV]\d+\.\d+(\.\d+)?(\s|$)/g, ' ')
    .replace(/\s+Ver\.\s*\d+\.\d+(\.\d+)?/gi, '')
    .replace(/\s+Version\s+\d+\.\d+(\.\d+)?/gi, '')
    .trim();
  
  cleaned = cleaned
    .replace(/^Brother\s+/i, '')
    .replace(/^HP\s+/i, '')
    .replace(/^RICOH\s+/i, '')
    .replace(/^TOSHIBA\s+/i, '')
    .replace(/^PANTUM\s+/i, '')
    .trim();
  
  const brotherMatch = cleaned.match(/(HL|MFC|DCP)-[A-Z0-9]+[^\s,]*/i);
  if (brotherMatch) {
    return `Brother ${brotherMatch[0]}`;
  }
  
  if (brand === 'RICOH') {
    const ricohMatch = cleaned.match(/(SP|M|IM|MP)\s+\d+[A-Z]*/i);
    if (ricohMatch) {
      return `RICOH ${ricohMatch[0]}`;
    }
  }
  
  const words = cleaned.split(/\s+/).filter(word => word.length > 0);
  if (words.length > 3) {
    cleaned = words.slice(0, 3).join(' ');
  } else {
    cleaned = words.join(' ');
  }
  
  return `${brand} ${cleaned}`;
}

function detectColorFromDescription(description) {
  if (!description) return null;
  
  const desc = description.toLowerCase();
  const patterns = {
    black: /(black|negro|bk|schwarz|noir|k\b)/i,
    cyan: /(cyan|cian|c\b)/i,
    magenta: /(magenta|m\b)/i,
    yellow: /(yellow|amarillo|gelb|jaune|y\b)/i
  };
  
  // Buscar coincidencias
  for (const [color, pattern] of Object.entries(patterns)) {
    if (pattern.test(desc)) {
      return color;
    }
  }
  
  return null;
}

/**
 * Mapeo de tipos de suministros según RFC 3805
 * prtMarkerSuppliesTypeTC
 */
const SUPPLY_TYPE_MAP = {
  1: 'other',
  2: 'unknown',
  3: 'toner',
  4: 'wasteToner',
  5: 'ink',
  6: 'inkCartridge',
  7: 'inkRibbon',
  8: 'wasteInk',
  9: 'opc',
  10: 'developer',
  11: 'fuserOil',
  12: 'solidWax',
  13: 'ribbonWax',
  14: 'wasteWax'
};

/**
 * OIDs estándar RFC 3805 (Printer MIB)
 */
const PRINTER_OIDS = {
  // Información del sistema
  sysDescr: '1.3.6.1.2.1.1.1.0',
  sysName: '1.3.6.1.2.1.1.5.0',
  sysUpTime: '1.3.6.1.2.1.1.3.0',
  
  // Información del dispositivo
  hrDeviceDescr: '1.3.6.1.2.1.25.3.2.1.3.1',
  hrDeviceID: '1.3.6.1.2.1.25.3.2.1.1.1',
  
  // Información de la impresora (RFC 3805)
  prtGeneralPrinterName: '1.3.6.1.2.1.43.5.1.1.16.1',
  prtGeneralSerialNumber: '1.3.6.1.2.1.43.5.1.1.17.1',
  
  // Suministros (RFC 3805)
  supplyDescription: '1.3.6.1.2.1.43.11.1.1.6.1',
  supplyType: '1.3.6.1.2.1.43.11.1.1.5.1',
  supplyLevel: '1.3.6.1.2.1.43.11.1.1.9.1',
  supplyMaxCapacity: '1.3.6.1.2.1.43.11.1.1.8.1',
  
  // Estado del dispositivo
  deviceStatus: '1.3.6.1.2.1.25.3.2.1.5.1',
  printerDetectedError: '1.3.6.1.2.1.25.3.5.1.2.1',
  printerStatus: '1.3.6.1.2.1.25.3.5.1.1.1',
  
  // Contadores
  prtMarkerLifeCount: '1.3.6.1.2.1.43.10.2.1.4.1.1'
};

/**
 * OIDs propietarios para marcas específicas
 */
const BRAND_OIDS = {
  BROTHER: {
    // OIDs especiales de Brother (súper OIDs con información completa)
    brInfoMaintenance: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.8.0',  // Buffer con info de mantenimiento
    brInfoCounter: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.10.0',     // Buffer con contadores
    brInfoNextCare: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.11.0',    // Páginas hasta próximo mantenimiento
    
    // Modelo y nombre
    modelName: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.4.3.0',
    productName: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.4.4.0',
    deviceName: '1.3.6.1.4.1.2435.2.4.3.99.1.1.2.1',
    
    // Serial de cartucho
    cartridgeSerial: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.4.101'
  },
  
  RICOH: {
    // Machine ID y Serial
    machineID: '1.3.6.1.4.1.367.3.2.1.2.1.4.0',
    serialNumber: '1.3.6.1.4.1.367.3.2.1.2.1.5.0',
    
    // Niveles de tóner
    tonerRemaining: '1.3.6.1.4.1.367.3.2.1.2.24.1.1.5.1',
    tonerStatus: '1.3.6.1.4.1.367.3.2.1.2.24.1.1.3.1',
    
    // Serial de cartucho
    cartridgeSerial: '1.3.6.1.4.1.367.3.2.1.2.24.1.1.6'
  },
  
  PANTUM: {
    // Serial
    serial: '1.3.6.1.4.1.20540.1.2.2.1.3.1',
    serialAlt: '1.3.6.1.4.1.20540.1.3.1.1.2.1',
    
    // Niveles de tóner
    tonerLevels: '1.3.6.1.4.1.20540.2.1.1.1.5',
    tonerStatus: '1.3.6.1.4.1.20540.2.1.1.1.4',
    tonerDescription: '1.3.6.1.4.1.20540.2.1.1.1.2',
    
    // Serial de cartucho
    cartridgeSerial: '1.3.6.1.4.1.20540.2.1.1.1.6',
    cartridgeName: '1.3.6.1.4.1.20540.2.1.1.1.2'
  }
};

/**
 * Determina si una impresora es monocromática basándose en el modelo
 * @param {string} model - Modelo de la impresora
 * @returns {boolean} true si es monocromática
 */
function isMonochromePrinter(model) {
  if (!model) return false;
  
  const monochromePatterns = [
    /HL-L5/i,          // Brother Serie L5000
    /HL-5/i,           // Brother Serie 5000
    /DCP-L/i,          // Brother DCP-L (monocromáticas)
    /MFC-L\d{4}D[WN]/i // Brother MFC-L monocromáticas
  ];
  
  return monochromePatterns.some(pattern => pattern.test(model));
}

/**
 * Extrae la versión de firmware de una descripción de sistema
 * @param {string} sysDescr - Descripción del sistema desde SNMP
 * @returns {string|null} Versión de firmware o null
 */
function extractFirmwareVersion(sysDescr) {
  if (!sysDescr) return null;
  
  const firmwarePatterns = [
    /Firmware Ver\.(\d+\.\d+(?:\.\d+)?)/i,  // "Firmware Ver.1.72"
    /Ver\.(\d+\.\d+(?:\.\d+)?)/i,           // "Ver.1.72"
    /[vV]er[\s:]*(\d+\.\d+(?:\.\d+)?)/i,    // "Ver 1.72" o "Ver: 1.72"
    /[vV](\d+\.\d+\.\d+)/,                   // "V1.72.2"
    /[vV](\d+\.\d+)/                         // "V1.72"
  ];
  
  for (const pattern of firmwarePatterns) {
    const match = sysDescr.match(pattern);
    if (match) {
      const version = match[1];
      // Validar que sea una versión numérica válida
      if (/^\d+\.\d+/.test(version)) {
        return 'V' + version;
      }
    }
  }
  
  return null;
}

module.exports = {
  cleanPrinterModel,
  detectColorFromDescription,
  isMonochromePrinter,
  extractFirmwareVersion,
  SUPPLY_TYPE_MAP,
  PRINTER_OIDS,
  BRAND_OIDS
};
