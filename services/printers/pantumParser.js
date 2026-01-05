/**
 * Pantum Printer Parser
 * Lógica específica para impresoras Pantum (series monocromáticas y color)
 */

const snmp = require('net-snmp');
const { snmpGet, snmpSubtree, detectColorFromDescription, getPantumWebTonerLevels } = require('../snmpService');

const PANTUM_OIDS = {
  tonerLevels: '1.3.6.1.4.1.20540.2.1.1.1.5',
  tonerStatus: '1.3.6.1.4.1.20540.2.1.1.1.4',
  tonerDescription: '1.3.6.1.4.1.20540.2.1.1.1.2',
  pantumSerial: '1.3.6.1.4.1.20540.1.2.2.1.3.1',
  pantumSerialAlt: '1.3.6.1.4.1.20540.1.3.1.1.2.1',
  pantumFirmware: '1.3.6.1.4.1.20540.1.1.1.1.2.1',
  pantumFirmwareAlt: '1.3.6.1.4.1.20540.1.2.1.1.3.1'
};

async function getPantumSerial(session) {
  const serialOids = [
    PANTUM_OIDS.pantumSerial,
    PANTUM_OIDS.pantumSerialAlt
  ];
  
  for (const oid of serialOids) {
    try {
      const result = await snmpGet(session, [oid]);
      if (result && result[0] && !snmp.isVarbindError(result[0])) {
        const value = result[0].value.toString().trim();
        if (value && /^[A-Z0-9]{10,20}$/.test(value)) {
          console.log(`   ✅ Serial PANTUM: ${value}`);
          return value;
        }
      }
    } catch (error) {
      continue;
    }
  }
  return null;
}

async function getPantumFirmware(session) {
  console.log(`   🔍 Escaneando árbol MIB de PANTUM...`);
  
  try {
    const fullPantumTree = await snmpSubtree(session, '1.3.6.1.4.1.20540');
    
    if (fullPantumTree.length > 0) {
      for (const vb of fullPantumTree) {
        if (!snmp.isVarbindError(vb)) {
          const value = vb.value.toString().trim();
          
          if (/^[vV]?\d+\.\d+(\.\d+)?$/.test(value)) {
            const firmware = value.startsWith('V') || value.startsWith('v') ? value : 'V' + value;
            console.log(`   ✅ Firmware PANTUM: ${firmware}`);
            return firmware;
          }
        }
      }
    }
  } catch (error) {
    console.log(`   ⚠️ Error escaneo MIB: ${error.message}`);
  }
  
  // Intentar OIDs directos
  const firmwareOids = [PANTUM_OIDS.pantumFirmware, PANTUM_OIDS.pantumFirmwareAlt];
  
  for (const oid of firmwareOids) {
    try {
      const result = await snmpGet(session, [oid]);
      if (result && result[0] && !snmp.isVarbindError(result[0])) {
        const value = result[0].value.toString().trim();
        if (/^[vV]?\d+\.\d+/.test(value)) {
          return value.startsWith('V') || value.startsWith('v') ? value : 'V' + value;
        }
      }
    } catch (error) {
      continue;
    }
  }
  
  return null;
}

async function getPantumTonerLevels(session) {
  const levels = {};
  
  console.log(`   🎯 Consultando niveles de tóner PANTUM...`);
  
  // ESTRATEGIA 1: OIDs propietarios PANTUM
  try {
    const tonerLevels = await snmpSubtree(session, PANTUM_OIDS.tonerLevels);
    const tonerDescriptions = await snmpSubtree(session, PANTUM_OIDS.tonerDescription);
    
    if (tonerLevels.length > 0) {
      tonerLevels.forEach((vb, index) => {
        if (!snmp.isVarbindError(vb)) {
          const level = parseInt(vb.value);
          const descVb = tonerDescriptions[index];
          const description = descVb ? descVb.value.toString() : '';
          
          const color = detectColorFromDescription(description);
          
          if (color && level >= 0 && level <= 100) {
            levels[color] = level;
            console.log(`   ✅ ${color.toUpperCase()}: ${level}% (OID propietario)`);
          }
        }
      });
      
      if (Object.keys(levels).length > 0) {
        return levels;
      }
    }
  } catch (error) {
    console.log(`   ⚠️ Error OIDs propietarios: ${error.message}`);
  }
  
  // ESTRATEGIA 2: RFC 3805 con descubrimiento de índices
  try {
    console.log(`   🔄 Estrategia RFC 3805 con descubrimiento de índices...`);
    
    const descBase = '1.3.6.1.2.1.43.11.1.1.6.1';
    const descriptionsTree = await snmpSubtree(session, descBase);
    
    const indexColorMap = {};
    descriptionsTree.forEach((vb) => {
      if (!snmp.isVarbindError(vb)) {
        const oid = Array.isArray(vb.oid) ? vb.oid.join('.') : vb.oid;
        const description = vb.value.toString().trim();
        const index = oid.split('.').pop();
        
        const color = detectColorFromDescription(description);
        if (color && ['black', 'cyan', 'magenta', 'yellow'].includes(color)) {
          indexColorMap[index] = { color, description };
        }
      }
    });
    
    // Consultar niveles con índices descubiertos
    for (const [index, info] of Object.entries(indexColorMap)) {
      const levelOid = `1.3.6.1.2.1.43.11.1.1.9.1.${index}`;
      const capOid = `1.3.6.1.2.1.43.11.1.1.8.1.${index}`;
      
      const [levelRes, capRes] = await Promise.all([
        snmpGet(session, [levelOid]).catch(() => null),
        snmpGet(session, [capOid]).catch(() => null)
      ]);
      
      if (levelRes && levelRes[0] && !snmp.isVarbindError(levelRes[0])) {
        const level = parseInt(levelRes[0].value);
        const cap = capRes && capRes[0] && !snmp.isVarbindError(capRes[0]) 
          ? parseInt(capRes[0].value) 
          : 100;
        
        if (level !== -2) {
          const percent = cap === 100 ? level : Math.round((level / cap) * 100);
          levels[info.color] = Math.max(0, Math.min(100, percent));
          console.log(`   ✅ ${info.color.toUpperCase()}: ${levels[info.color]}%`);
        }
      }
    }
  } catch (error) {
    console.log(`   ⚠️ Error RFC 3805: ${error.message}`);
  }
  
  return levels;
}

async function getPantumCartridgeInfo(session) {
  const cartridgeInfo = {};
  
  const cartridgeIdOids = [
    '1.3.6.1.4.1.20540.2.1.1.1.6',
    '1.3.6.1.4.1.20540.2.1.1.1.2',
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
              
              if (baseOid.includes('20540.2.1.1.1.6')) {
                cartridgeInfo[index].serial = value;
              } else if (baseOid.includes('20540.2.1.1.1.2')) {
                cartridgeInfo[index].name = value;
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

async function parsePantumPrinter(session, basicData) {
  const data = { ...basicData };
  
  // Serial
  const serial = await getPantumSerial(session);
  if (serial) data.serial = serial;
  
  // Firmware
  const firmware = await getPantumFirmware(session);
  if (firmware) data.firmware = firmware;
  
  // Niveles de tóner
  const levels = await getPantumTonerLevels(session);
  data.levels = { ...data.levels, ...levels };
  
  // Información de cartuchos
  const cartridgeInfo = await getPantumCartridgeInfo(session);
  data.cartridgeInfo = cartridgeInfo;
  
  return data;
}

module.exports = {
  parsePantumPrinter,
  getPantumSerial,
  getPantumFirmware,
  getPantumTonerLevels,
  PANTUM_OIDS
};
