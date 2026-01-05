/**
 * Generic Printer Parser
 * Parser genérico RFC 3805 para impresoras HP y otras marcas estándar
 */

const snmp = require('net-snmp');
const { snmpGet, snmpSubtree, detectColorFromDescription, PRINTER_OIDS } = require('../snmpService');

/**
 * Obtiene niveles de tóner usando RFC 3805 estándar
 */
async function getGenericTonerLevels(session, brand) {
  const levels = {};
  
  console.log(`   🎯 Consultando niveles con RFC 3805 (${brand})...`);
  
  try {
    const descriptions = await snmpSubtree(session, PRINTER_OIDS.supplyDescription);
    const maxCapacities = await snmpSubtree(session, PRINTER_OIDS.supplyMaxCapacity);
    const currentLevels = await snmpSubtree(session, PRINTER_OIDS.supplyLevel);
    
    console.log(`   ✓ Encontrados ${descriptions.length} suministros`);
    
    if (descriptions.length > 0) {
      descriptions.forEach((descVb, index) => {
        const description = descVb.value.toString();
        const color = detectColorFromDescription(description);
        const maxCap = maxCapacities[index] ? parseInt(maxCapacities[index].value) : -99;
        const current = currentLevels[index] ? parseInt(currentLevels[index].value) : -99;
        
        if (color && ['black', 'cyan', 'magenta', 'yellow'].includes(color)) {
          let percentage = 0;
          
          // Manejar valores especiales RFC 3805
          if (current === -2) {
            percentage = 100; // Lleno
          } else if (current === -3) {
            percentage = 0; // Desconocido
          } else if (current >= 0 && maxCap > 0) {
            percentage = Math.round((current / maxCap) * 100);
          } else if (current >= 0 && current <= 100 && (maxCap === -2 || maxCap === -3)) {
            percentage = current; // Ya es porcentaje
          }
          
          levels[color] = Math.max(0, Math.min(100, percentage));
          console.log(`   ✅ ${color.toUpperCase()}: ${levels[color]}%`);
        }
      });
    }
  } catch (error) {
    console.log(`   ⚠️ Error RFC 3805: ${error.message}`);
  }
  
  // Si no se detectaron colores, intentar por índices
  if (Object.keys(levels).length === 0) {
    try {
      const currentLevels = await snmpSubtree(session, PRINTER_OIDS.supplyLevel);
      const maxCapacities = await snmpSubtree(session, PRINTER_OIDS.supplyMaxCapacity);
      
      const isColorPrinter = ['HP', 'CANON', 'EPSON'].includes(brand);
      const commonColors = isColorPrinter 
        ? ['black', 'cyan', 'magenta', 'yellow'] 
        : ['black'];
      
      for (let i = 0; i < Math.min(commonColors.length, currentLevels.length); i++) {
        if (currentLevels[i]) {
          const maxCap = maxCapacities[i] ? parseInt(maxCapacities[i].value) : 100;
          const current = parseInt(currentLevels[i].value);
          let percentage = maxCap > 0 ? Math.round((current / maxCap) * 100) : 0;
          
          if (current === -2) percentage = 100;
          if (current === -3) percentage = 50;
          if (current < 0) percentage = 0;
          
          levels[commonColors[i]] = Math.max(0, Math.min(100, percentage));
          console.log(`   ✅ ${commonColors[i]}: ${percentage}%`);
        }
      }
    } catch (error) {
      console.log(`   ⚠️ Error detección por índices: ${error.message}`);
    }
  }
  
  return levels;
}

/**
 * Obtiene serial usando OIDs estándar
 */
async function getGenericSerial(session) {
  const serialOid = '1.3.6.1.2.1.43.5.1.1.17.1';
  
  try {
    const result = await snmpGet(session, [serialOid]);
    if (result && result[0] && !snmp.isVarbindError(result[0])) {
      const value = result[0].value.toString().trim();
      if (value && value !== 'Not Specified' && !value.includes('Unknown')) {
        console.log(`   ✅ Serial: ${value}`);
        return value;
      }
    }
  } catch (error) {
    console.log(`   ⚠️ Error serial: ${error.message}`);
  }
  
  return null;
}

/**
 * Obtiene firmware usando OIDs estándar
 */
async function getGenericFirmware(session) {
  const firmwareOids = [
    '1.3.6.1.2.1.25.3.2.1.4.1',
    '1.3.6.1.2.1.43.5.1.1.16.1'
  ];
  
  for (const oid of firmwareOids) {
    try {
      const result = await snmpGet(session, [oid]);
      if (result && result[0] && !snmp.isVarbindError(result[0])) {
        const value = result[0].value.toString().trim();
        if (value && /^[vV]?\d+\.\d+/.test(value)) {
          const firmware = value.startsWith('V') || value.startsWith('v') ? value : 'V' + value;
          console.log(`   ✅ Firmware: ${firmware}`);
          return firmware;
        }
      }
    } catch (error) {
      continue;
    }
  }
  
  return null;
}

/**
 * Parser genérico para HP y otras marcas estándar
 */
async function parseGenericPrinter(session, basicData) {
  const data = { ...basicData };
  
  // Serial
  const serial = await getGenericSerial(session);
  if (serial) data.serial = serial;
  
  // Firmware
  const firmware = await getGenericFirmware(session);
  if (firmware) data.firmware = firmware;
  
  // Niveles de tóner
  const levels = await getGenericTonerLevels(session, data.brand);
  data.levels = { ...data.levels, ...levels };
  
  return data;
}

module.exports = {
  parseGenericPrinter,
  getGenericTonerLevels,
  getGenericSerial,
  getGenericFirmware
};
