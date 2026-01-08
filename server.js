/**
 * Gestor de Impresoras API
 * Arquitectura: MVC + Services
 * Auth: Express Session + MongoDB
 * Protocolo: SNMP v2c
 */


try {
    require.resolve('dotenv');
    require.resolve('express');
    require.resolve('mongoose');
    require.resolve('net-snmp');
    require.resolve('cors');
    require.resolve('multer');
} catch (e) {
    console.error('\n❌ ERROR: Faltan dependencias. Ejecuta: npm install');
    console.error('   Detalle:', e.message);
    process.exit(1);
}

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');

console.log('🔍 [DEBUG] PORT from .env:', process.env.PORT);

const appConfig = require('./config/app.config');
const corsConfig = require('./config/cors.config');
const createSessionConfig = require('./config/session.config');
const { upload, uploadDir } = require('./config/multer.config');
const { connectDatabase } = require('./config/database.config');

const snmpQueryService = require('./services/snmpQueryService');
const logger = require('./utils/logger');
const { getLocalIp } = require('./utils/network');

const authMiddlewareFactory = require('./middleware/auth');
const requestLogger = require('./middleware/requestLogger');
const mountRoutes = require('./routes/index');
const { isDatabaseConnected } = require('./config/database.config');

const app = express();
const generateId = () => Math.random().toString(36).substr(2, 9);
const { addSystemLog } = logger;

app.use(cors(corsConfig));
app.use(express.json({ limit: appConfig.jsonLimit }));
app.use('/uploads', express.static(uploadDir));
app.use(requestLogger);

// Middleware de verificación de base de datos
const dbCheckMiddleware = (req, res, next) => {
  // Excluir health check del middleware
  if (req.path === '/api/health' || req.path === '/') {
    return next();
  }
  
  if (!isDatabaseConnected()) {
    return res.status(503).json({
      error: 'Servicio temporalmente no disponible',
      details: 'Base de datos no conectada. El sistema está intentando reconectar.',
      code: 'DB_UNAVAILABLE',
      retryAfter: 5
    });
  }
  next();
};

// Inicialización asíncrona: Conectar MongoDB y configurar sesiones
(async () => {
  const dbConnected = await connectDatabase();
  
  // Configurar sesiones (funcionará cuando MongoDB se conecte)
  if (dbConnected) {
    app.use(session(createSessionConfig()));
    console.log('✅ Sesiones configuradas con MongoDB Store');
  } else {
    console.warn('⚠️  Sesiones NO configuradas - MongoDB no disponible');
    console.warn('⚠️  Las sesiones se configurarán automáticamente al reconectar');
  }
  
  // Aplicar middleware de verificación de DB
  app.use(dbCheckMiddleware);

  const { requireAuth, requireAdmin, attachUser, authMiddleware } = authMiddlewareFactory();

  const routeContext = {
    generateId,
    mockSnmpQuery: snmpQueryService.mockSnmpQuery
  };

  const routeMiddleware = {
    requireAuth,
    requireAdmin,
    attachUser,
    authMiddleware
  };

  const routeConfig = {
    appConfig,
    upload
  };

  mountRoutes(app, routeContext, routeMiddleware, routeConfig);

  app.listen(appConfig.port, '0.0.0.0', () => {
      const ip = getLocalIp();
      console.log(`\n🚀 SERVIDOR ACTIVO en:`);
      console.log(`   - Local:   http://localhost:${appConfig.port}`);
      console.log(`   - Red:     http://${ip}:${appConfig.port}`);
      console.log(`\nEsperando conexiones del Frontend...`);
      
      addSystemLog('success', 'SERVER', 'Servidor iniciado correctamente', `Puerto: ${appConfig.port}, IP: ${ip}`);
      addSystemLog('info', 'SERVER', 'Sistema de logs activo', 'Monitoreo en tiempo real disponible');
  });
})();
