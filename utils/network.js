// ============================================================================
// UTILIDADES DE RED
// ============================================================================

const os = require('os');

/**
 * Obtiene la IP local de la interfaz de red activa
 * @returns {string} IP local o 'localhost'
 */
const getLocalIp = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

module.exports = {
  getLocalIp
};
