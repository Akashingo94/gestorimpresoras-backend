/**
 * Request Logger Middleware
 * Middleware para logging de peticiones HTTP
 */

const logger = require('../utils/logger');

/**
 * Middleware de logging de peticiones HTTP
 * Registra todas las peticiones y loguea operaciones importantes al sistema
 */
function requestLogger(req, res, next) {
  console.log(`📩 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  
  // Log de peticiones importantes (excepto stream y health checks)
  if (!req.url.includes('/stream') && !req.url.includes('/health') && req.url.startsWith('/api/')) {
    const method = req.method;
    const endpoint = req.url.split('?')[0];
    
    // Solo loguear operaciones importantes
    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      logger.addSystemLog('info', 'API', `${method} ${endpoint}`, req.session?.username || 'No autenticado');
    }
  }
  
  next();
}

module.exports = requestLogger;
