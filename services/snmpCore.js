/**
 * Servicio SNMP - Funciones Básicas
 * Wrapper de operaciones SNMP básicas y utilidades
 */

const snmp = require('net-snmp');
const dns = require('dns').promises;

/**
 * Wrapper para SNMP GET (retorna Promise)
 * @param {Session} session - Sesión SNMP activa
 * @param {Array<string>} oids - Array de OIDs a consultar
 * @returns {Promise<Array>} Varbinds resultantes
 */
function snmpGet(session, oids) {
  return new Promise((resolve, reject) => {
    session.get(oids, (error, varbinds) => {
      if (error) {
        reject(error);
      } else {
        resolve(varbinds);
      }
    });
  });
}

/**
 * Wrapper para SNMP SUBTREE (retorna Promise)
 * @param {Session} session - Sesión SNMP activa
 * @param {string} oid - OID base para escanear subárbol
 * @returns {Promise<Array>} Array de varbinds del subárbol
 */
function snmpSubtree(session, oid) {
  return new Promise((resolve, reject) => {
    const results = [];
    session.subtree(oid, 
      (varbinds) => {
        varbinds.forEach(vb => {
          if (snmp.isVarbindError(vb)) return;
          results.push(vb);
        });
      },
      (error) => {
        if (error) reject(error);
        else resolve(results);
      }
    );
  });
}

/**
 * Resuelve hostname a dirección IP
 * @param {string} hostname - Nombre del host a resolver
 * @returns {Promise<string|null>} IP resuelta o null si falla
 */
async function resolveHostnameToIP(hostname) {
  try {
    console.log(`🔍 Resolviendo hostname "${hostname}" a IP...`);
    const addresses = await dns.resolve4(hostname);
    if (addresses && addresses.length > 0) {
      const resolvedIP = addresses[0];
      console.log(`   ✅ Hostname resuelto: ${hostname} -> ${resolvedIP}`);
      return resolvedIP;
    }
  } catch (error) {
    console.log(`   ❌ No se pudo resolver hostname "${hostname}": ${error.message}`);
  }
  return null;
}

/**
 * Prueba conectividad SNMP básica con múltiples comunidades
 * @param {string} ip - Dirección IP del dispositivo
 * @param {string} community - Comunidad SNMP inicial a probar
 * @returns {Promise<Object>} Resultado de conectividad con comunidad válida
 */
async function testSnmpConnectivity(ip, community = 'public') {
  const testCommunities = [community, 'public', 'private', 'admin'];
  
  for (const testComm of testCommunities) {
    const session = snmp.createSession(ip, testComm, { 
      timeout: 3000,
      retries: 1,
      version: snmp.Version2c
    });
    
    try {
      // Intentar OID más básico (sysDescr)
      const result = await snmpGet(session, ['1.3.6.1.2.1.1.1.0']);
      if (result && result[0] && !snmp.isVarbindError(result[0])) {
        console.log(`✅ SNMP conectado a ${ip} con comunidad: ${testComm}`);
        session.close();
        return { success: true, community: testComm, sysDescr: result[0].value.toString() };
      }
    } catch (error) {
      // Continuar con la siguiente comunidad
    } finally {
      session.close();
    }
  }
  
  return { success: false, community: null, error: 'No se pudo conectar con ninguna comunidad' };
}

/**
 * Crea una sesión SNMP configurada
 * @param {string} ip - Dirección IP del dispositivo
 * @param {string} community - Comunidad SNMP
 * @param {Object} options - Opciones adicionales
 * @returns {Session} Sesión SNMP configurada
 */
function createSnmpSession(ip, community = 'public', options = {}) {
  const defaultOptions = {
    timeout: 5000,
    retries: 2,
    version: snmp.Version2c
  };
  
  return snmp.createSession(ip, community, { ...defaultOptions, ...options });
}

module.exports = {
  snmpGet,
  snmpSubtree,
  resolveHostnameToIP,
  testSnmpConnectivity,
  createSnmpSession,
  snmp // Exportar módulo snmp para acceso a constantes
};
