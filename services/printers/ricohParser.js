/**
 * Ricoh Printer Parser
 * Lógica específica para impresoras Ricoh (M 320F, series comerciales)
 */

const snmp = require('net-snmp');
const { snmpGet, snmpSubtree, detectColorFromDescription } = require('../snmpService');

const RICOH_OIDS = {
  tonerRemaining: '1.3.6.1.4.1.367.3.2.1.2.24.1.1.5.1',
  tonerStatus: '1.3.6.1.4.1.367.3.2.1.2.24.1.1.3.1',
  ricohMachineID: '1.3.6.1.4.1.367.3.2.1.2.1.4.0',
  ricohSerialNumber: '1.3.6.1.4.1.367.3.2.1.2.1.5.0',
  ricohFirmwareVersion: '1.3.6.1.4.1.367.3.2.1.2.1.3.0',
  
  branches: [
    '1.3.6.1.4.1.367.3.2.1.2.1',
    '1.3.6.1.4.1.367.3.2.1.1',
    '1.3.6.1.4.1.367.3.2.1.2.24.1.1',
    '1.3.6.1.4.1.367.1.2.1.1'
  ]
};

async function getRicohSerial(session) {
  const serialOids = [
    RICOH_OIDS.ricohMachineID,
    RICOH_OIDS.ricohSerialNumber
  ];
  
  for (const oid of serialOids) {
    try {
      const result = await snmpGet(session, [oid]);
      if (result && result[0] && !snmp.isVarbindError(result[0])) {
        const value = result[0].value.toString().trim();
        if (value && /^[A-Z0-9]{10,15}$/.test(value)) {
          console.log(`   ✅ Serial RICOH: ${value}`);
          return value;
        }
      }
    } catch (error) {
      continue;
    }
  }
  return null;
}

async function getRicohFirmware(session) {
  console.log(`   🔍 Escaneando árbol MIB de RICOH...`);
  
  for (const branch of RICOH_OIDS.branches) {
    try {
      const ricohInfoTree = await snmpSubtree(session, branch);
      
      if (ricohInfoTree.length > 0) {
        for (const vb of ricohInfoTree) {
          if (!snmp.isVarbindError(vb)) {
            const value = vb.value.toString().trim();
            
            if (value && /^[vV]\d+\.\d+(\.\d+)?$/.test(value)) {
              console.log(`   ✅ Firmware RICOH: ${value}`);
              return value;
            }
          }
        }
      }
    } catch (error) {
      console.log(`   ⚠️ Error en rama ${branch}: ${error.message}`);
    }
  }
  
  // Intentar OID directo
  try {
    const result = await snmpGet(session, [RICOH_OIDS.ricohFirmwareVersion]);
    if (result && result[0] && !snmp.isVarbindError(result[0])) {
      const value = result[0].value.toString().trim();
      if (/^[vV]?\d+\.\d+/.test(value)) {
        return value.startsWith('V') || value.startsWith('v') ? value : 'V' + value;
      }
    }
  } catch (error) {
    console.log(`   ⚠️ Error firmware directo: ${error.message}`);
  }
  
  return null;
}

async function getRicohTonerLevels(session) {
  const levels = {};
  
  console.log(`   🎯 Consultando niveles de tóner RICOH...`);
  
  // ESTRATEGIA 1: OID propietario RICOH
  try {
    const tonerLevel = await snmpGet(session, [RICOH_OIDS.tonerRemaining]);
    if (tonerLevel && tonerLevel[0] && !snmp.isVarbindError(tonerLevel[0])) {
      const rawValue = tonerLevel[0].value;
      let level = NaN;
      
      if (typeof rawValue === 'number') {
        level = rawValue;
      } else if (Buffer.isBuffer(rawValue)) {
        for (let i = 0; i < Math.min(4, rawValue.length); i++) {
          const byteVal = rawValue[i];
          if (byteVal >= 0 && byteVal <= 100 && isNaN(level)) {
            level = byteVal;
            break;
          }
        }
      } else if (typeof rawValue === 'string') {
        level = parseInt(rawValue);
      }
      
      if (!isNaN(level) && level >= 0 && level <= 100) {
        levels.black = level;
        console.log(`   ✅ BLACK: ${level}% (OID propietario)`);
        return levels;
      }
    }
  } catch (error) {
    console.log(`   ⚠️ Error OID propietario: ${error.message}`);
  }
  
  // ESTRATEGIA 2: RFC 3805 estándar
  try {
    const suppliesLevels = await snmpSubtree(session, '1.3.6.1.2.1.43.11.1.1.9.1');
    const suppliesMaxCapacity = await snmpSubtree(session, '1.3.6.1.2.1.43.11.1.1.8.1');
    const suppliesDescriptions = await snmpSubtree(session, '1.3.6.1.2.1.43.11.1.1.6.1');
    
    if (suppliesLevels.length > 0) {
      suppliesLevels.forEach((vb, idx) => {
        if (!snmp.isVarbindError(vb)) {
          const currentLevel = parseInt(vb.value);
          const maxCapacity = suppliesMaxCapacity[idx] && !snmp.isVarbindError(suppliesMaxCapacity[idx])
            ? parseInt(suppliesMaxCapacity[idx].value)
            : 100;
          const description = suppliesDescriptions[idx] && !snmp.isVarbindError(suppliesDescriptions[idx])
            ? suppliesDescriptions[idx].value.toString().toLowerCase()
            : '';
          
          const percentage = maxCapacity > 0 ? Math.round((currentLevel / maxCapacity) * 100) : currentLevel;
          const color = detectColorFromDescription(description);
          
          if (color && !isNaN(percentage) && percentage >= 0 && percentage <= 100) {
            levels[color] = percentage;
            console.log(`   ✅ ${color.toUpperCase()}: ${percentage}% (RFC 3805)`);
          }
        }
      });
    }
  } catch (error) {
    console.log(`   ⚠️ Error RFC 3805: ${error.message}`);
  }
  
  return levels;
}

async function getRicohCartridgeInfo(session) {
  const cartridgeInfo = {};
  
  const cartridgeIdOids = [
    '1.3.6.1.4.1.367.3.2.1.2.24.1.1.6',
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
              
              if (baseOid.includes('24.1.1.6')) {
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
      continue;
    }
  }
  
  return cartridgeInfo;
}

async function parseRicohPrinter(session, basicData) {
  const data = { ...basicData };
  
  // Serial
  const serial = await getRicohSerial(session);
  if (serial) data.serial = serial;
  
  // Firmware
  const firmware = await getRicohFirmware(session);
  if (firmware) data.firmware = firmware;
  
  // Niveles de tóner
  const levels = await getRicohTonerLevels(session);
  data.levels = { ...data.levels, ...levels };
  
  // Información de cartuchos
  const cartridgeInfo = await getRicohCartridgeInfo(session);
  data.cartridgeInfo = cartridgeInfo;
  
  return data;
}

module.exports = {
  parseRicohPrinter,
  getRicohSerial,
  getRicohFirmware,
  getRicohTonerLevels,
  RICOH_OIDS
};
