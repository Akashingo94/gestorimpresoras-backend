/**
 * System Log Controller
 * Maneja logs del sistema en tiempo real vía SSE
 */

const {
  getSystemLogs,
  registerLogClient,
  unregisterLogClient,
  clearSystemLogs,
  addSystemLog
} = require('../utils/logger');

/**
 * Stream de logs en tiempo real (SSE)
 */
function streamLogs(req, res) {
  console.log('🎯 Cliente intentando conectar a /api/logs/stream');
  console.log('   Usuario:', req.session?.username);
  const systemLogs = getSystemLogs();
  console.log('   Logs disponibles:', systemLogs.length);
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Enviar logs existentes primero
  console.log('   📤 Enviando últimos 50 logs al cliente...');
  systemLogs.slice(-50).forEach(log => {
    res.write(`data: ${JSON.stringify(log)}\n\n`);
  });
  
  // Registrar cliente para recibir logs en tiempo real
  registerLogClient(res);
  console.log('   ✅ Cliente agregado');
  addSystemLog('info', 'LOGS', 'Cliente conectado al stream de logs');
  
  // Remover cliente cuando se desconecte
  req.on('close', () => {
    unregisterLogClient(res);
    console.log('   ❌ Cliente desconectado');
    addSystemLog('info', 'LOGS', 'Cliente desconectado del stream de logs');
  });
}

/**
 * Obtiene historial de logs del sistema
 */
function getLogsHistory(req, res) {
  console.log('📚 Petición de logs históricos');
  console.log('   Usuario:', req.session?.username);
  const systemLogs = getSystemLogs();
  console.log('   Logs disponibles:', systemLogs.length);
  const limit = parseInt(req.query.limit) || 500;
  const logs = systemLogs.slice(-limit);
  console.log('   📤 Enviando', logs.length, 'logs');
  res.json(logs);
}

/**
 * Limpia todos los logs del sistema
 */
function clearLogs(req, res) {
  const systemLogs = getSystemLogs();
  const count = systemLogs.length;
  clearSystemLogs();
  addSystemLog('warn', 'LOGS', `Logs limpiados por ${req.session.user.username}`, `${count} entradas eliminadas`);
  res.json({ success: true, cleared: count });
}

module.exports = {
  streamLogs,
  getLogsHistory,
  clearLogs
};
