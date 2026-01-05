/**
 * Network Controller
 * Maneja escaneo de red para descubrimiento automático de impresoras
 */

const dns = require('dns').promises;
const { addSystemLog } = require('../utils/logger');
const { snmp, snmpGet, PRINTER_OIDS, detectColorFromDescription } = require('../services/snmpService');

/**
 * Escanea rangos de red para descubrir impresoras automáticamente
 * Usa streaming para ir enviando resultados en tiempo real
 */
async function scanNetwork(req, res) {
  const { ranges } = req.body;

  if (!ranges || !Array.isArray(ranges) || ranges.length === 0) {
    return res.status(400).json({ error: 'Se requiere al menos un rango de red' });
  }

  // Configurar respuesta con streaming
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');

  const sendUpdate = (data) => {
    const jsonString = JSON.stringify(data) + '\n';
    res.write(jsonString);
    console.log(`📤 Enviando al frontend:`, data.type, data.printer ? `IP: ${data.printer.ip}` : '');
  };

  try {
    addSystemLog('info', 'NETWORK', `Iniciando escaneo de red`, `${ranges.length} rango(s) configurados`);
    
    const ipsToScan = parseRanges(ranges);
    console.log(`🔍 Iniciando escaneo de ${ipsToScan.length} IPs en rangos:`, ranges);
    
    const discovered = [];
    let scannedCount = 0;

    // Escanear en lotes de 80 IPs paralelas para máxima velocidad
    const batchSize = 80;
    for (let i = 0; i < ipsToScan.length; i += batchSize) {
      const batch = ipsToScan.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (ip) => {
        try {
          scannedCount++;
          sendUpdate({ 
            type: 'progress', 
            progress: { current: scannedCount, total: ipsToScan.length },
            currentIP: ip
          });

          const printerInfo = await probePrinter(ip);
          
          if (printerInfo) {
            discovered.push(printerInfo);
            sendUpdate({ type: 'found', printer: printerInfo });
            console.log(`   ✅ Impresora agregada: ${printerInfo.brand} ${printerInfo.model} en ${ip}`);
            addSystemLog('success', 'SNMP', `Impresora detectada: ${printerInfo.brand} ${printerInfo.model}`, `IP: ${ip}`);
            
            if (res.flush) res.flush();
          }
        } catch (error) {
          console.log(`   ⚠️  Error en ${ip}:`, error.message);
        }
      }));
    }

    console.log(`✅ Escaneo completado: ${discovered.length} impresoras encontradas`);
    addSystemLog('success', 'NETWORK', `Escaneo de red completado`, `${discovered.length} impresoras encontradas de ${ipsToScan.length} IPs escaneadas`);
    sendUpdate({ type: 'complete', count: discovered.length });
    res.end();

  } catch (error) {
    console.error('Error en escaneo de red:', error);
    addSystemLog('error', 'NETWORK', `Error en escaneo de red`, error.message);
    sendUpdate({ type: 'error', message: error.message });
    res.end();
  }
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Parsea rangos de IPs (formato: "192.168.1.1-254")
 */
function parseRanges(ranges) {
  const ipsToScan = [];
  
  for (const range of ranges) {
    const [base, rangeStr] = range.split('-');
    const parts = base.split('.');
    
    if (parts.length === 4 && rangeStr) {
      const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
      const start = parseInt(parts[3]);
      const end = parseInt(rangeStr);
      
      for (let i = start; i <= end; i++) {
        ipsToScan.push(`${subnet}.${i}`);
      }
    }
  }
  
  return ipsToScan;
}

/**
 * Prueba si una IP responde como impresora
 */
async function probePrinter(ip) {
  const communities = ['public', 'private', 'admin', 'password'];
  let result = null;
  let workingCommunity = null;

  for (const community of communities) {
    try {
      const session = snmp.createSession(ip, community, {
        timeout: 6000,
        retries: 1,
        version: snmp.Version2c
      });

      // Consultar OIDs básicos
      const basicOids = [
        PRINTER_OIDS.sysDescr,
        PRINTER_OIDS.sysName,
        '1.3.6.1.2.1.25.3.2.1.3.1' // hrDeviceDescr
      ];

      result = await snmpGet(session, basicOids);
      session.close();
      
      if (result && result[0] && !snmp.isVarbindError(result[0])) {
        workingCommunity = community;
        console.log(`   ✅ SNMP respondió en ${ip} con comunidad "${community}"`);
        
        // Intentar OIDs adicionales (opcional)
        try {
          const extSession = snmp.createSession(ip, community, {
            timeout: 3000,
            retries: 1,
            version: snmp.Version2c
          });
          
          const extOids = [
            '1.3.6.1.2.1.43.5.1.1.16.1',
            '1.3.6.1.2.1.43.5.1.1.17.1',
            '1.3.6.1.4.1.367.3.2.1.2.1.4.0',
            '1.3.6.1.4.1.367.3.2.1.2.19.1.0.1'
          ];
          
          const extResult = await snmpGet(extSession, extOids);
          extSession.close();
          
          if (extResult && extResult[0] && !snmp.isVarbindError(extResult[0])) {
            result = result.concat(extResult);
          }
        } catch (extError) {
          // No crítico
        }
        
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (!result || !result[0] || snmp.isVarbindError(result[0])) {
    throw new Error('No SNMP response with any community');
  }

  // Verificar si es una impresora
  const sysDescr = result[0] ? result[0].value.toString() : '';
  const sysName = result[1] ? result[1].value.toString() : '';
  const hrDeviceDescr = result[2] ? result[2].value.toString() : '';
  
  const description = `${sysDescr} ${sysName} ${hrDeviceDescr}`.toLowerCase();
  
  // Verificar si es un dispositivo excluido
  const excludeKeywords = [
    'routeros', 'mikrotik', 'router', 'switch', 'ccr', 'crs', 'rb',
    'cisco', 'juniper', 'ubiquiti', 'unifi', 'firewall', 'gateway'
  ];
  
  const isExcluded = excludeKeywords.some(keyword => description.includes(keyword));
  
  if (isExcluded) {
    throw new Error('Device is excluded (not a printer)');
  }
  
  // Detectar si es impresora
  const printerKeywords = [
    'printer', 'print', 'mfp', 'multifunction', 'copier', 'fax', 'scanner',
    'xerox', 'ricoh', 'brother', 'hp', 'canon', 'epson', 'kyocera',
    'toshiba', 'lexmark', 'samsung', 'konica', 'sharp', 'pantum',
    'm 320', 'm320', 'aficio', 'imagio', 'laserjet', 'deskjet', 'officejet'
  ];
  
  const hasKeyword = printerKeywords.some(keyword => description.includes(keyword));
  const hasValidDescr = sysDescr && sysDescr.length > 0;
  const isPrinter = hasKeyword || hasValidDescr;
  
  if (!isPrinter) {
    throw new Error('Not a printer');
  }
  
  // Extraer información
  const brand = detectBrand(description);
  const model = extractModel(hrDeviceDescr, sysDescr, brand);
  
  // Resolver hostname
  let hostname = ip;
  try {
    const hosts = await dns.reverse(ip);
    if (hosts && hosts.length > 0) {
      hostname = hosts[0];
    }
  } catch (e) {
    // Hostname no disponible
  }

  return {
    ip,
    hostname,
    model,
    brand,
    serial: result[3] ? result[3].value.toString().trim() : undefined,
    status: 'discovered'
  };
}

/**
 * Detecta la marca del dispositivo
 */
function detectBrand(description) {
  if (description.includes('brother')) return 'BROTHER';
  if (description.includes('ricoh')) return 'RICOH';
  if (description.includes('hp') || description.includes('hewlett')) return 'HP';
  if (description.includes('canon')) return 'CANON';
  if (description.includes('epson')) return 'EPSON';
  if (description.includes('xerox')) return 'XEROX';
  if (description.includes('kyocera')) return 'KYOCERA';
  if (description.includes('toshiba')) return 'TOSHIBA';
  if (description.includes('konica')) return 'KONICA';
  if (description.includes('sharp')) return 'SHARP';
  if (description.includes('samsung')) return 'SAMSUNG';
  if (description.includes('lexmark')) return 'LEXMARK';
  if (description.includes('pantum')) return 'PANTUM';
  return 'UNKNOWN';
}

/**
 * Extrae el modelo del dispositivo
 */
function extractModel(hrDeviceDescr, sysDescr, brand) {
  // Priorizar hrDeviceDescr para Ricoh
  if (hrDeviceDescr && hrDeviceDescr.length > 0) {
    return hrDeviceDescr.trim();
  }
  
  // Fallback: extraer de sysDescr
  if (brand !== 'UNKNOWN' && sysDescr) {
    const parts = sysDescr.split(',');
    if (parts.length > 0) {
      const model = parts[0].replace(new RegExp(brand, 'gi'), '').trim();
      if (model && model !== brand && model.length > 0) {
        return model;
      }
    }
  }
  
  return sysDescr ? sysDescr.substring(0, 50) : 'Dispositivo de Red';
}

module.exports = {
  scanNetwork
};
