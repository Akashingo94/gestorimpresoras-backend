/**
 * Brother Printer Parser
 * Lógica específica para impresoras Brother (DCP, HL, MFC series)
 * Extraído de snmpQueryService.js para mejor mantenibilidad
 */

const snmp = require('net-snmp');
const {
  snmpGet,
  snmpSubtree,
  parseBrotherMaintenanceInfo,
  parseBrotherCounterInfo
} = require('../snmpService');

// OIDs específicos de Brother
const BROTHER_OIDS = {
  // Información de mantenimiento completa
  brInfoMaintenance: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.8.0',
  brInfoCounter: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.10.0',
  brInfoNextCare: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.11.0',
  
  // Estado y errores
  brStatusInfo: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.4.11.0',
  brErrorInfo: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.9.0',
  brWarningInfo: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.15.0',
  
  // Niveles de tóner
  tonerBlack: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.10.0',
  tonerCyan: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.11.0',
  tonerMagenta: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.12.0',
  tonerYellow: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.13.0',
  
  // Componentes de mantenimiento
  drumLife: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.1.0',
  
  // Modelo específico
  brotherModelName: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.4.3.0',
  
  // Firmware
  brotherMainFirmware: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.17.0',
  brotherSubFirmware: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.18.0',
  
  // Ramas para escaneo
  branches: [
    '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5',
    '1.3.6.1.4.1.2435.2.4.3.99',
    '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.4'
  ]
};

/**
 * Detecta si es impresora monocromática por modelo
 */
function isMonochromePrinter(model) {
  if (!model) return false;
  return model.includes('HL-L5') ||
         model.includes('HL-5') ||
         model.includes('DCP-L') ||
         model.includes('MFC-L') ||
         model.match(/HL-[0-9]/);
}

/**
 * Parsea valores Brother que pueden venir como Buffer
 */
function parseBrotherValue(result) {
  if (!result || !result[0] || snmp.isVarbindError(result[0])) return NaN;
  
  const rawValue = result[0].value;
  let value = NaN;
  
  if (typeof rawValue === 'number') {
    value = rawValue;
  } else if (Buffer.isBuffer(rawValue)) {
    if (rawValue.length >= 14) {
      // Byte 13 = porcentaje CONSUMIDO (invertir para obtener restante)
      const consumed = rawValue[13];
      value = 100 - consumed;
    } else if (rawValue.length === 1) {
      value = rawValue[0];
    } else if (rawValue.length === 2) {
      value = rawValue.readUInt16BE(0);
    } else if (rawValue.length === 4) {
      value = rawValue.readUInt32BE(0);
    } else {
      // Buscar byte válido (0-100)
      for (let i = 0; i < rawValue.length; i++) {
        if (rawValue[i] >= 0 && rawValue[i] <= 100) {
          value = rawValue[i];
          break;
        }
      }
    }
  } else if (typeof rawValue === 'string') {
    value = parseInt(rawValue);
  }
  
  return value;
}

/**
 * Obtiene modelo Brother específico
 */
async function getBrotherModel(session, sysDescrModel, hrDeviceModel, printerModelName) {
  let rawModel = null;
  
  console.log(`   🔍 Analizando modelos disponibles:`);
  console.log(`      sysDescr: ${sysDescrModel ? sysDescrModel.substring(0, 50) + '...' : 'N/A'}`);
  console.log(`      hrDeviceDescr: ${hrDeviceModel || 'N/A'}`);
  console.log(`      prtPrinterName: ${printerModelName || 'N/A'}`);
  
  // PRIORIDAD 1: hrDeviceDescr - generalmente tiene el modelo real
  if (hrDeviceModel && hrDeviceModel.match(/(HL|MFC|DCP)-[A-Z0-9]+/i)) {
    rawModel = hrDeviceModel.includes('Brother') ? hrDeviceModel : `Brother ${hrDeviceModel}`;
    console.log(`   ✅ Usando hrDeviceDescr (modelo real): ${rawModel}`);
    return rawModel; // Retornar inmediatamente si encontramos el modelo aquí
  }
  
  // PRIORIDAD 2: prtGeneralPrinterName
  if (printerModelName && printerModelName.match(/(MFC|DCP|HL)-[A-Z0-9]+/i)) {
    rawModel = printerModelName.includes('Brother') ? printerModelName : `Brother ${printerModelName}`;
    console.log(`   ✅ Usando prtGeneralPrinterName: ${rawModel}`);
    return rawModel;
  }
  
  // PRIORIDAD 3: sysDescr (puede ser el servidor NC)
  rawModel = sysDescrModel || hrDeviceModel;
  
  // Si detectamos servidor de red NC-8300h, buscar modelo real
  if (rawModel && (rawModel.includes('NC-8300') || rawModel.includes('NC-'))) {
    console.log(`   🔍 Servidor de red Brother NC-8300h detectado, buscando modelo real...`);
    
    const brotherModelOids = [
      '1.3.6.1.4.1.2435.2.4.3.99.3.1.6.1.2.1',   // Brother NC Device Info (contiene MODEL="...")
      '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.4.4.0',    // Nombre del producto
      '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.4.3.0',    // Nombre del modelo
      '1.3.6.1.4.1.2435.2.4.3.99.1.1.2.1',       // Nombre del dispositivo
      '1.3.6.1.2.1.25.3.2.1.3.1',                // hrDeviceDescr (ya consultado antes)
      '1.3.6.1.2.1.43.5.1.1.16.1',               // prtGeneralPrinterName
      '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.1.5.0'     // Brother device model alternative
    ];
    
    for (const oid of brotherModelOids) {
      try {
        const result = await snmpGet(session, [oid]);
        if (result && result[0] && !snmp.isVarbindError(result[0])) {
          const value = result[0].value.toString();
          
          // Parsear formato MODEL="DCP-8155DN" del NC
          let modelMatch = value.match(/MODEL="([^"]+)"/i);
          if (modelMatch) {
            rawModel = 'Brother ' + modelMatch[1];
            console.log(`   🎯 Modelo NC encontrado en ${oid}: ${rawModel}`);
            break;
          }
          
          // Buscar patrón normal de modelo Brother
          modelMatch = value.match(/(HL|MFC|DCP)-[A-Z0-9]+[^\s,]*/i);
          if (modelMatch) {
            rawModel = 'Brother ' + modelMatch[0];
            console.log(`   🎯 Modelo real encontrado en ${oid}: ${rawModel}`);
            break;
          }
        }
      } catch (error) {
        console.log(`   ✗ Error en OID ${oid}: ${error.message}`);
      }
    }
    
    // Si aún no encontramos, hacer SNMP walk en la rama de Brother
    if (!rawModel || rawModel.includes('NC-')) {
      console.log(`   🔍 Haciendo SNMP Walk en rama Brother...`);
      try {
        const brotherTree = await snmpSubtree(session, '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.4');
        for (const vb of brotherTree) {
          if (!snmp.isVarbindError(vb)) {
            const value = vb.value.toString();
            const modelMatch = value.match(/(HL|MFC|DCP)-[A-Z0-9]+[^\s,]*/i);
            if (modelMatch) {
              rawModel = 'Brother ' + modelMatch[0];
              console.log(`   🎯 Modelo encontrado en árbol MIB: ${rawModel}`);
              break;
            }
          }
        }
      } catch (error) {
        console.log(`   ⚠️ Error en SNMP Walk: ${error.message}`);
      }
    }
  }
  
  return rawModel;
}

/**
 * Obtiene firmware Brother
 */
async function getBrotherFirmware(session, sysDescrModel) {
  let firmware = null;
  
  // Escanear ramas Brother para encontrar firmware
  console.log(`   🔍 Escaneando árbol MIB de BROTHER...`);
  
  const isNetworkServer = sysDescrModel && /NC-\d+h/i.test(sysDescrModel);
  if (isNetworkServer) {
    console.log(`   ⚠️ Servidor de red ${sysDescrModel.match(/NC-\d+h/i)?.[0]} detectado`);
  }
  
  for (const branch of BROTHER_OIDS.branches) {
    try {
      const brotherInfoTree = await snmpSubtree(session, branch);
      
      if (brotherInfoTree.length > 0) {
        for (const vb of brotherInfoTree) {
          if (!snmp.isVarbindError(vb)) {
            const value = vb.value.toString().trim();
            
            // Detectar firmware numérico (no códigos como ZC)
            const isFirmwarePattern = /^\d+\.\d+(\.\d+)?$/.test(value);
            if (isFirmwarePattern && !firmware) {
              firmware = 'V' + value;
              console.log(`   ✅ Firmware detectado: ${firmware}`);
              return firmware;
            }
          }
        }
      }
    } catch (error) {
      console.log(`   ⚠️ Error en rama ${branch}: ${error.message}`);
    }
  }
  
  // Intentar OIDs específicos si el escaneo no funcionó
  if (!firmware) {
    const firmwareOids = [
      BROTHER_OIDS.brotherSubFirmware,
      BROTHER_OIDS.brotherMainFirmware
    ];
    
    for (const oid of firmwareOids) {
      try {
        const result = await snmpGet(session, [oid]);
        if (result && result[0] && !snmp.isVarbindError(result[0])) {
          const value = result[0].value.toString().trim();
          if (/^[vV]?\d+\.\d+(\.\d+)?$/.test(value)) {
            firmware = value.startsWith('V') || value.startsWith('v') ? value : 'V' + value;
            break;
          }
        }
      } catch (error) {
        continue;
      }
    }
  }
  
  return firmware;
}

/**
 * Obtiene niveles de tóner Brother
 */
async function getBrotherTonerLevels(session, model) {
  const levels = {};
  const isMonochrome = isMonochromePrinter(model);
  
  console.log(`   🎯 Consultando niveles de tóner BROTHER...`);
  console.log(`   📋 Tipo: ${isMonochrome ? 'MONOCROMÁTICA' : 'COLOR'}`);
  console.log(`   💡 Estrategia: brInfoMaintenance → RFC 3805 → OIDs propietarios`);
  
  // ESTRATEGIA 0: brInfoMaintenance (súper OID con info completa)
  try {
    const maintenanceResult = await snmpGet(session, [BROTHER_OIDS.brInfoMaintenance]);
    if (maintenanceResult && maintenanceResult[0] && !snmp.isVarbindError(maintenanceResult[0])) {
      const buffer = maintenanceResult[0].value;
      console.log(`   ✅ brInfoMaintenance respondió`);
      
      const maintenanceInfo = parseBrotherMaintenanceInfo(buffer);
      
      if (maintenanceInfo.toner !== null && maintenanceInfo.toner >= 0 && maintenanceInfo.toner <= 100) {
        levels.black = maintenanceInfo.toner;
        console.log(`   ✅ brInfoMaintenance: BLACK = ${levels.black}%`);
        return levels;
      }
    }
  } catch (error) {
    console.log(`   ⚠️ brInfoMaintenance no disponible: ${error.message}`);
  }
  
  // ESTRATEGIA 1: RFC 3805 estándar
  try {
    const standardResult = await snmpGet(session, ['1.3.6.1.2.1.43.11.1.1.9.1.1']);
    if (standardResult && standardResult[0] && !snmp.isVarbindError(standardResult[0])) {
      const level = parseInt(standardResult[0].value);
      
      if (!isNaN(level) && level >= 0 && level <= 100) {
        levels.black = level;
        console.log(`   ✅ RFC 3805: BLACK = ${level}%`);
        return levels;
      }
    }
  } catch (error) {
    console.log(`   ⚠️ RFC 3805 no disponible: ${error.message}`);
  }
  
  // ESTRATEGIA 2: OIDs propietarios Brother individuales
  try {
    const colors = isMonochrome ? ['black'] : ['black', 'cyan', 'magenta', 'yellow'];
    const oids = [
      BROTHER_OIDS.tonerBlack,
      ...(isMonochrome ? [] : [BROTHER_OIDS.tonerCyan, BROTHER_OIDS.tonerMagenta, BROTHER_OIDS.tonerYellow])
    ];
    
    const promises = oids.map(oid => snmpGet(session, [oid]).catch(() => null));
    const results = await Promise.all(promises);
    
    results.forEach((result, index) => {
      if (result && result[0] && !snmp.isVarbindError(result[0])) {
        const level = parseBrotherValue(result);
        
        if (!isNaN(level) && level >= 0 && level <= 100) {
          levels[colors[index]] = level;
          console.log(`   ✅ ${colors[index].toUpperCase()}: ${level}%`);
        }
      }
    });
  } catch (error) {
    console.log(`   ⚠️ Error con OIDs propietarios: ${error.message}`);
  }
  
  if (Object.keys(levels).length === 0) {
    console.log(`   ⚠️ No se pudo obtener ningún nivel de tóner BROTHER`);
  }
  
  return levels;
}

/**
 * Obtiene número de serie Brother
 * Intenta múltiples OIDs hasta encontrar un serial válido
 */
async function getBrotherSerialNumber(session) {
  console.log(`   🔖 Consultando número de serie BROTHER...`);
  
  // Priorizar el OID estándar que sabemos que funciona en DCP-8155DN
  const serialOids = [
    { oid: '1.3.6.1.2.1.43.5.1.1.17.1', name: 'prtGeneralSerialNumber (RFC 3805) ⭐' },
    { oid: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.1.1.0', name: 'Brother serial #1' },
    { oid: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.4.1.0', name: 'Brother serial #2' },
    { oid: '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.4.5.0', name: 'Brother serial #3' },
    { oid: '1.3.6.1.4.1.2435.2.4.3.99.3.1.6.1.2.1', name: 'Brother NC device info' }
  ];
  
  for (const { oid, name } of serialOids) {
    try {
      const result = await snmpGet(session, [oid]);
      if (result && result[0] && !snmp.isVarbindError(result[0])) {
        let serial = result[0].value.toString().trim();
        
        // Si viene en formato MODEL="..." extraer solo el contenido
        if (serial.includes('MODEL=')) {
          console.log(`   ⚠️ ${name}: Contiene modelo, no serial`);
          continue;
        }
        
        // Validar que sea un serial real (mínimo 6 caracteres, contiene letras Y números)
        if (serial && serial.length >= 6 && /[A-Z]/i.test(serial) && /[0-9]/.test(serial)) {
          console.log(`   ✅ Serial encontrado (${name}): ${serial}`);
          return serial;
        } else if (serial && serial.length >= 4) {
          console.log(`   ⚠️ ${name}: Valor no válido como serial: ${serial}`);
        }
      }
    } catch (error) {
      console.log(`   ✗ Error en ${name}: ${error.message}`);
    }
  }
  
  // Si no encontramos serial, hacer SNMP Walk en ramas Brother
  console.log(`   🔍 Buscando serial en árbol MIB de Brother...`);
  const branches = [
    '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.4',
    '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.1'
  ];
  
  for (const branch of branches) {
    try {
      const tree = await snmpSubtree(session, branch);
      for (const vb of tree) {
        if (!snmp.isVarbindError(vb)) {
          const value = vb.value.toString().trim();
          // Buscar patrones de serial (letras y números, 8-20 caracteres)
          if (value && value.length >= 8 && value.length <= 20 && /^[A-Z0-9]+$/i.test(value)) {
            console.log(`   🎯 Posible serial encontrado en MIB: ${value}`);
            return value;
          }
        }
      }
    } catch (error) {
      console.log(`   ⚠️ Error en rama ${branch}: ${error.message}`);
    }
  }
  
  console.log(`   ⚠️ No se encontró número de serie válido`);
  return null;
}

/**
 * Obtiene estado y errores específicos de Brother
 */
async function getBrotherStatus(session) {
  console.log(`   🚨 Consultando estado y errores BROTHER...`);
  
  const statusInfo = {
    errors: [],
    warnings: [],
    drumLife: null,
    nextMaintenance: null
  };
  
  // Obtener información del buffer de mantenimiento
  try {
    const maintenanceResult = await snmpGet(session, [BROTHER_OIDS.brInfoMaintenance]);
    if (maintenanceResult && maintenanceResult[0] && !snmp.isVarbindError(maintenanceResult[0])) {
      const buffer = maintenanceResult[0].value;
      if (Buffer.isBuffer(buffer) && buffer.length > 0) {
        console.log(`   📊 Buffer de mantenimiento obtenido (${buffer.length} bytes)`);
        
        // Parsear información del buffer
        const maintenanceInfo = parseBrotherMaintenanceInfo(buffer);
        
        // Revisar vida del tambor
        if (maintenanceInfo.drum !== null && maintenanceInfo.drum < 20) {
          statusInfo.warnings.push(`Tambor bajo: ${maintenanceInfo.drum}% - Considere reemplazo`);
          statusInfo.drumLife = maintenanceInfo.drum;
        } else if (maintenanceInfo.drum !== null && maintenanceInfo.drum < 50) {
          statusInfo.drumLife = maintenanceInfo.drum;
          console.log(`   🟢 Vida del tambor: ${maintenanceInfo.drum}%`);
        }
      }
    }
  } catch (error) {
    console.log(`   ⚠️ Error consultando mantenimiento: ${error.message}`);
  }
  
  // Obtener páginas hasta el próximo mantenimiento
  try {
    const nextCareResult = await snmpGet(session, [BROTHER_OIDS.brInfoNextCare]);
    if (nextCareResult && nextCareResult[0] && !snmp.isVarbindError(nextCareResult[0])) {
      const buffer = nextCareResult[0].value;
      if (Buffer.isBuffer(buffer) && buffer.length >= 4) {
        const pagesUntilMaintenance = buffer.readUInt32BE(0);
        statusInfo.nextMaintenance = pagesUntilMaintenance;
        
        if (pagesUntilMaintenance < 1000) {
          statusInfo.warnings.push(`Mantenimiento próximo: ${pagesUntilMaintenance} páginas`);
        }
        console.log(`   🔧 Páginas hasta mantenimiento: ${pagesUntilMaintenance}`);
      }
    }
  } catch (error) {
    console.log(`   ⚠️ Error consultando próximo mantenimiento: ${error.message}`);
  }
  
  // Intentar OIDs específicos de estado Brother
  const statusOids = [
    { oid: BROTHER_OIDS.brStatusInfo, name: 'Estado Brother' },
    { oid: BROTHER_OIDS.brErrorInfo, name: 'Error Brother' },
    { oid: BROTHER_OIDS.brWarningInfo, name: 'Advertencia Brother' }
  ];
  
  for (const { oid, name } of statusOids) {
    try {
      const result = await snmpGet(session, [oid]);
      if (result && result[0] && !snmp.isVarbindError(result[0])) {
        const value = result[0].value;
        if (value && value.toString().trim().length > 0) {
          console.log(`   🔍 ${name}: ${value}`);
        }
      }
    } catch (error) {
      // Silencioso, no todos los modelos tienen estos OIDs
    }
  }
  
  return statusInfo;
}

/**
 * Obtiene información de cartuchos Brother
 */
async function getBrotherCartridgeInfo(session) {
  const cartridgeInfo = {};
  
  console.log(`   🔖 Consultando información de cartuchos BROTHER...`);
  
  const cartridgeIdOids = [
    '1.3.6.1.4.1.2435.2.3.9.4.2.1.5.4.101',
    '1.3.6.1.2.1.43.11.1.1.7',
    '1.3.6.1.2.1.43.11.1.1.8'
  ];
  
  for (const baseOid of cartridgeIdOids) {
    try {
      const cartridgeIds = await snmpSubtree(session, baseOid);
      if (cartridgeIds.length > 0) {
        cartridgeIds.forEach((vb) => {
          if (!snmp.isVarbindError(vb)) {
            const oid = Array.isArray(vb.oid) ? vb.oid.join('.') : vb.oid;
            const value = vb.value.toString().trim();
            const index = oid.split('.').pop();
            
            if (value && value.length > 0 && value.length < 200) {
              if (!cartridgeInfo[index]) cartridgeInfo[index] = {};
              
              if (baseOid.includes('2435.2.3.9.4.2.1.5.4.101')) {
                cartridgeInfo[index].serial = value;
              } else if (baseOid.includes('43.11.1.1.7')) {
                cartridgeInfo[index].name = value;
              } else if (baseOid.includes('43.11.1.1.8')) {
                cartridgeInfo[index].capacity = value;
              }
            }
          }
        });
      }
    } catch (error) {
      console.log(`   ⚠️ Error consultando ${baseOid}: ${error.message}`);
    }
  }
  
  return cartridgeInfo;
}

/**
 * Parser principal para impresoras Brother
 */
async function parseBrotherPrinter(session, basicData) {
  const { model, sysDescrModel, hrDeviceModel, printerModelName } = basicData;
  const data = { ...basicData };
  
  // Obtener modelo específico Brother
  const brotherModel = await getBrotherModel(session, sysDescrModel, hrDeviceModel, printerModelName);
  if (brotherModel) {
    data.rawModel = brotherModel;
    data.model = brotherModel; // Actualizar el modelo que se muestra
    console.log(`   ✅ Modelo actualizado: ${brotherModel}`);
  }
  
  // Obtener firmware
  const firmware = await getBrotherFirmware(session, sysDescrModel);
  if (firmware) {
    data.firmware = firmware;
  }
  
  // Obtener número de serie
  const serial = await getBrotherSerialNumber(session);
  if (serial) {
    data.serial = serial;
  }
  
  // Obtener niveles de tóner
  const levels = await getBrotherTonerLevels(session, data.model);
  data.levels = { ...data.levels, ...levels };
  
  // Obtener estado y errores específicos de Brother
  const statusInfo = await getBrotherStatus(session);
  if (statusInfo.errors.length > 0) {
    data.errors = [...(data.errors || []), ...statusInfo.errors];
  }
  if (statusInfo.warnings.length > 0) {
    data.errors = [...(data.errors || []), ...statusInfo.warnings];
  }
  if (statusInfo.drumLife !== null) {
    data.drumLife = statusInfo.drumLife;
  }
  if (statusInfo.nextMaintenance !== null) {
    data.nextMaintenance = statusInfo.nextMaintenance;
  }
  
  // Obtener información de cartuchos
  const cartridgeInfo = await getBrotherCartridgeInfo(session);
  data.cartridgeInfo = cartridgeInfo;
  
  // Limpiar niveles si es monocromática
  if (isMonochromePrinter(data.model)) {
    const blackLevel = data.levels.black || 0;
    data.levels = { black: blackLevel };
    console.log(`   🎯 Limpieza (monocromática): Solo negro = ${blackLevel}%`);
  }
  
  return data;
}

module.exports = {
  parseBrotherPrinter,
  getBrotherModel,
  getBrotherFirmware,
  getBrotherSerialNumber,
  getBrotherTonerLevels,
  getBrotherStatus,
  getBrotherCartridgeInfo,
  isMonochromePrinter,
  BROTHER_OIDS
};
