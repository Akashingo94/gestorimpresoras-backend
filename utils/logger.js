let systemLogs = [];
let logClients = [];

function addSystemLog(level, category, message, details = null) {
  const logEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    details
  };
  
  systemLogs.push(logEntry);
  if (systemLogs.length > 1000) {
    systemLogs.shift();
  }
  
  logClients.forEach(client => {
    client.write(`data: ${JSON.stringify(logEntry)}\n\n`);
  });
  
  const emoji = {
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
    success: '✅'
  }[level] || '📝';
  
  const color = {
    info: '\x1b[36m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    success: '\x1b[32m'
  }[level] || '\x1b[37m';
  
  console.log(`${emoji} ${color}[${category}]\x1b[0m ${message}${details ? ' - ' + details : ''}`);
}

function registerLogClient(client) {
  logClients.push(client);
}

/**
 * Elimina un cliente SSE de la lista
 * @param {Response} client - Objeto de respuesta Express
 */
function unregisterLogClient(client) {
  logClients = logClients.filter(c => c !== client);
}

/**
 * Obtiene todos los logs del sistema
 * @returns {Array} Array de logs
 */
function getSystemLogs() {
  return systemLogs;
}

/**
 * Limpia todos los logs del sistema
 */
function clearSystemLogs() {
  systemLogs = [];
  addSystemLog('info', 'SYSTEM', 'Logs del sistema limpiados');
}

/**
 * Genera un ID único para los logs
 * @returns {string} ID generado
 */
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

module.exports = {
  addSystemLog,
  registerLogClient,
  unregisterLogClient,
  getSystemLogs,
  clearSystemLogs
};
