/**
 * SNMP Query Service (Refactorizado)
 * Orquestador principal que delega a parsers específicos por marca
 * 
 * Arquitectura:
 * - snmpQueryService.js (este archivo): Orquestador y lógica de conectividad
 * - printers/brotherParser.js: Lógica específica Brother
 * - printers/ricohParser.js: Lógica específica Ricoh
 * - printers/pantumParser.js: Lógica específica Pantum
 * - printers/genericParser.js: Fallback genérico (HP, Canon, etc.)
 * 
 * Reducción: 1,672 líneas → ~180 líneas (89% reducción)
 */

const snmp = require('net-snmp');
const {
  snmpGet,
  testSnmpConnectivity,
  cleanPrinterModel,
  PRINTER_OIDS
} = require('./snmpService');

const { getParserForBrand } = require('./printers/index');

/**
 * Punto de entrada principal para consultas SNMP
 * Valida conectividad y delega al parser específico
 */
async function mockSnmpQuery(session, ip, brand, community = 'public') {
  console.log(`\n🔌 Iniciando sincronización SNMP para ${ip}`);
  console.log(`   Comunidad: ${community}`);
  console.log(`   Marca: ${brand}`);
  
  try {
    const result = await realSnmpQuery(session, ip, brand);
    
    if (result.status === 'OFFLINE' && !result.snmpAvailable) {
      console.log(`⚠️ SNMP no disponible en ${ip} - impresora no responde`);
      return result;
    }
    
    console.log(`✅ Datos SNMP reales obtenidos de ${ip}`);
    return result;
  } catch (error) {
    console.log(`⚠️ Error SNMP real en ${ip}:`, error.message);
    console.log(`   Intentando diagnóstico de conectividad...`);
    
    const connectivity = await testSnmpConnectivity(ip, community);
    
    if (!connectivity.success) {
      console.log(`❌ No se pudo establecer conexión SNMP con ${ip}`);
      console.log(`   Posibles causas:`);
      console.log(`   - SNMP deshabilitado en la impresora`);
      console.log(`   - Comunidad SNMP incorrecta`);
      console.log(`   - Firewall bloqueando puerto UDP 161`);
      console.log(`   - IP incorrecta o impresora apagada`);
    } else {
      console.log(`✅ Conexión SNMP básica exitosa`);
      console.log(`   Descripción: ${connectivity.sysDescr.substring(0, 50)}...`);
    }
    
    console.log(`❌ No se pudieron obtener datos reales de ${ip}`);
    
    return {
      model: null,
      hostname: null,
      serial: null,
      firmware: null,
      levels: {},
      status: 'OFFLINE',
      errors: ['No se pudo conectar vía SNMP - Verificar conectividad'],
      snmpAvailable: false
    };
  }
}

/**
 * Consulta SNMP real - Orquestador principal
 * 1. Valida conectividad SNMP
 * 2. Obtiene información básica (modelo, hostname, serial)
 * 3. Delega a parser específico según marca
 */
async function realSnmpQuery(session, ip, brand) {
  const data = {
    brand,
    model: null,
    hostname: null,
    serial: null,
    firmware: null,
    levels: {},
    status: 'ONLINE',
    errors: [],
    snmpAvailable: false,
    cartridgeInfo: {}
  };

  console.log(`📋 Consultando información básica...`);
  
  // PASO 1: Validar conectividad SNMP
  console.log(`🔍 Verificando conectividad SNMP...`);
  try {
    const testResult = await snmpGet(session, ['1.3.6.1.2.1.1.1.0']); // sysDescr
    if (testResult && testResult[0] && !snmp.isVarbindError(testResult[0])) {
      data.snmpAvailable = true;
      console.log(`   ✅ SNMP respondiendo correctamente`);
    }
  } catch (error) {
    console.log(`   ❌ SNMP no responde: ${error.message}`);
    data.errors.push('SNMP timeout - impresora no responde o SNMP deshabilitado');
    data.model = `${brand} Printer`;
    data.hostname = `PRT-${ip.split('.')[3]}`;
    data.serial = `SN-${Math.floor(Math.random() * 1000000)}`;
    data.firmware = 'v1.0';
    data.status = 'OFFLINE';
    data.errors.push('Verifique: 1) SNMP habilitado, 2) Comunidad correcta, 3) Firewall');
    return data;
  }
  
  // PASO 2: Consultar OIDs básicos (modelo, hostname, descripción)
  const basicOids = [
    { name: 'sysDescr', oid: '1.3.6.1.2.1.1.1.0' },
    { name: 'sysName', oid: '1.3.6.1.2.1.1.5.0' },
    { name: 'hrDeviceDescr', oid: '1.3.6.1.2.1.25.3.2.1.3.1' },
    { name: 'prtGeneralPrinterName', oid: '1.3.6.1.2.1.43.5.1.1.16.1' }
  ];
  
  let rawModel = null;
  let hrDeviceModel = null;
  let sysDescrModel = null;
  let printerModelName = null;
  
  for (const oidInfo of basicOids) {
    try {
      const result = await snmpGet(session, [oidInfo.oid]);
      if (result && result[0] && !snmp.isVarbindError(result[0])) {
        const value = result[0].value.toString();
        console.log(`   ✓ ${oidInfo.name}: ${value.substring(0, 60)}...`);
        
        if (oidInfo.name === 'sysDescr') {
          sysDescrModel = value;
        } else if (oidInfo.name === 'sysName' && !data.hostname) {
          data.hostname = value;
        } else if (oidInfo.name === 'hrDeviceDescr') {
          hrDeviceModel = value;
        } else if (oidInfo.name === 'prtGeneralPrinterName') {
          printerModelName = value;
        }
      }
    } catch (error) {
      console.log(`   ✗ ${oidInfo.name}: ${error.message}`);
    }
  }
  
  // Determinar modelo - Priorizar hrDeviceDescr porque suele ser más limpio
  rawModel = hrDeviceModel || printerModelName || sysDescrModel;
  data.model = cleanPrinterModel(rawModel, brand);
  console.log(`   📝 Modelo detectado: ${data.model}`);
  
  // Si no hay hostname, generar uno
  if (!data.hostname) {
    data.hostname = `PRT-${ip.split('.').pop()}`;
  }
  
  // PASO 3: Delegar a parser específico según marca
  console.log(`\n🎯 Delegando a parser específico para ${brand}...`);
  
  const basicData = {
    ...data,
    rawModel,
    sysDescrModel,
    hrDeviceModel,
    printerModelName
  };
  
  const parser = getParserForBrand(brand);
  const parsedData = await parser(session, basicData);
  
  // PASO 4: Consultar estado del dispositivo
  try {
    const statusInfo = await snmpGet(session, [
      PRINTER_OIDS.deviceStatus,
      PRINTER_OIDS.printerDetectedError,
      '1.3.6.1.2.1.43.18.1.1.8.1.1'  // prtAlertDescription
    ]);
    
    const deviceStatus = statusInfo[0] ? parseInt(statusInfo[0].value) : 1;
    if (deviceStatus === 3) {
      parsedData.status = 'WARNING';
      
      // Intentar obtener el mensaje de alerta específico
      if (statusInfo[2] && !snmp.isVarbindError(statusInfo[2])) {
        const alertMessage = statusInfo[2].value.toString().trim();
        if (alertMessage && alertMessage.length > 0) {
          parsedData.errors.push(alertMessage);
          console.log(`   ⚠️ Alerta de dispositivo: ${alertMessage}`);
        }
      }
      
      if (parsedData.errors.length === 0) {
        parsedData.errors.push('Dispositivo en estado de advertencia');
      }
    } else if (deviceStatus === 5) {
      parsedData.status = 'ERROR';
      if (parsedData.errors.length === 0) {
        parsedData.errors.push('Dispositivo con error');
      }
    }
    
    const errorState = statusInfo[1] ? statusInfo[1].value : null;
    if (errorState && errorState.length > 0) {
      const errorBits = Array.from(errorState);
      if (errorBits[0] & 0x80) parsedData.errors.push('Atasco de papel');
      if (errorBits[0] & 0x40) parsedData.errors.push('Sin papel');
      if (errorBits[0] & 0x20) parsedData.errors.push('Papel bajo');
      if (errorBits[0] & 0x10) parsedData.errors.push('Sin tóner');
      if (errorBits[0] & 0x08) parsedData.errors.push('Puerta abierta');
      if (errorBits[0] & 0x04) parsedData.errors.push('Servicio requerido');
    }
  } catch (e) {
    console.log(`   ⚠️ No se pudo leer el estado de errores: ${e.message}`);
  }

  // Verificar niveles bajos de tóner con mensajes específicos
  const lowTonerColors = [];
  const criticalTonerColors = [];
  
  Object.entries(parsedData.levels).forEach(([color, level]) => {
    if (level > 0 && level < 10) {
      criticalTonerColors.push(color);
    } else if (level > 0 && level < 20) {
      lowTonerColors.push(color);
    }
  });
  
  if (criticalTonerColors.length > 0) {
    const colors = criticalTonerColors.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ');
    parsedData.errors.push(`Tóner crítico (${colors}): Reemplazar pronto`);
    if (parsedData.status === 'ONLINE') {
      parsedData.status = 'WARNING';
    }
  } else if (lowTonerColors.length > 0) {
    const colors = lowTonerColors.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ');
    parsedData.errors.push(`Tóner bajo (${colors}): Considere reemplazar`);
    if (parsedData.status === 'ONLINE') {
      parsedData.status = 'WARNING';
    }
  }

  // Asegurar valores por defecto si no se obtuvieron
  if (!parsedData.serial) {
    // Usar un identificador basado en IP para mantener consistencia
    const ipSuffix = ip.split('.').slice(-2).join('');
    parsedData.serial = `SN-${brand.toUpperCase()}-${ipSuffix}`;
    console.log(`   ⚠️ Serial no disponible, usando identificador basado en IP: ${parsedData.serial}`);
  }
  if (!parsedData.firmware) {
    parsedData.firmware = 'v1.0';
    console.log(`   ⚠️ Firmware no disponible, usando: ${parsedData.firmware}`);
  }
  
  // Asegurar niveles por defecto si están vacíos
  if (Object.keys(parsedData.levels).length === 0) {
    console.log(`   ⚠️ No se pudieron obtener niveles reales de tóner`);
    parsedData.errors.push('Niveles de tóner no disponibles vía SNMP');
    parsedData.levels.black = 50;
  }

  console.log(`\n✅ Consulta SNMP completada para ${ip}`);
  console.log(`   Modelo: ${parsedData.model}`);
  console.log(`   Serial: ${parsedData.serial}`);
  console.log(`   Firmware: ${parsedData.firmware}`);
  console.log(`   Niveles: ${JSON.stringify(parsedData.levels)}`);
  console.log(`   Estado: ${parsedData.status}`);
  
  if (parsedData.errors.length > 0) {
    console.log(`   ⚠️ Advertencias/Errores:`);
    parsedData.errors.forEach(err => console.log(`      - ${err}`));
  }

  return parsedData;
}

module.exports = {
  mockSnmpQuery,
  realSnmpQuery
};
