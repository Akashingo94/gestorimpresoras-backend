/**
 * Servicio SNMP - Módulo Principal
 * Orquesta todas las operaciones SNMP del sistema
 */

// Importar módulos de núcleo
const {
  snmpGet,
  snmpSubtree,
  resolveHostnameToIP,
  testSnmpConnectivity,
  createSnmpSession,
  snmp
} = require('./snmpCore');

// Importar utilidades
const {
  cleanPrinterModel,
  detectColorFromDescription,
  isMonochromePrinter,
  extractFirmwareVersion,
  SUPPLY_TYPE_MAP,
  PRINTER_OIDS,
  BRAND_OIDS
} = require('./snmpUtils');

// Importar parsers de Brother
const {
  parseBrotherMaintenanceInfo,
  parseBrotherCounterInfo,
  parseBrotherTonerBuffer
} = require('./snmpBrotherParsers');

/**
 * Obtiene niveles de tóner de Pantum vía web scraping
 * Usado como fallback cuando SNMP no funciona correctamente
 * @param {string} ip - Dirección IP de la impresora Pantum
 * @returns {Promise<Object>} Niveles de tóner
 */
async function getPantumWebTonerLevels(ip) {
  const http = require('http');
  
  return new Promise((resolve, reject) => {
    console.log(`   🌐 Intentando obtener niveles desde interfaz web HTTP...`);
    
    // Intentar diferentes URLs comunes de PANTUM
    const urls = [
      `/general/status.html`,
      `/status.html`,
      `/general/information.html`,
      `/`,
      `/cgi-bin/dynamic/printer/config/reports/deviceStatus.html`
    ];
    
    const tryUrl = (urlIndex) => {
      if (urlIndex >= urls.length) {
        console.log(`   ⚠️ No se pudo acceder a la interfaz web de PANTUM`);
        return resolve({});
      }
      
      const url = urls[urlIndex];
      console.log(`   📡 Probando: http://${ip}${url}`);
      
      const req = http.get(`http://${ip}${url}`, { timeout: 5000 }, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          console.log(`   ✓ Respuesta recibida (${data.length} bytes)`);
          
          // Parsear el HTML simplemente
          const tonerMatch = data.match(/Toner.*?(\d+)%/i);
          
          if (tonerMatch) {
            const level = parseInt(tonerMatch[1]);
            console.log(`   ✅ Nivel de tóner Pantum (web): ${level}%`);
            resolve({ black: level });
          } else {
            // Intentar siguiente URL
            tryUrl(urlIndex + 1);
          }
        });
      });
      
      req.on('error', (err) => {
        console.log(`   ✗ Error en ${url}: ${err.message}`);
        tryUrl(urlIndex + 1);
      });
      
      req.on('timeout', () => {
        req.destroy();
        console.log(`   ✗ Timeout en ${url}`);
        tryUrl(urlIndex + 1);
      });
    };
    
    tryUrl(0);
  });
}

/**
 * NOTA: realSnmpQuery y mockSnmpQuery se mantienen en server.js por ahora
 * debido a su complejidad (1500+ líneas). Se migrarán en una fase posterior.
 * 
 * Este módulo proporciona todas las funciones de utilidad necesarias.
 */

// Exportar todas las funciones y constantes
module.exports = {
  // Core SNMP
  snmpGet,
  snmpSubtree,
  resolveHostnameToIP,
  testSnmpConnectivity,
  createSnmpSession,
  snmp,
  
  // Utilidades
  cleanPrinterModel,
  detectColorFromDescription,
  isMonochromePrinter,
  extractFirmwareVersion,
  SUPPLY_TYPE_MAP,
  PRINTER_OIDS,
  BRAND_OIDS,
  
  // Parsers Brother
  parseBrotherMaintenanceInfo,
  parseBrotherCounterInfo,
  parseBrotherTonerBuffer,
  
  // Funciones específicas
  getPantumWebTonerLevels
};
