/**
 * Routes Index
 * Centraliza el montaje de todas las rutas de la aplicación
 */

// Importar routers de features
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const printerRoutes = require('./printerRoutes');
const logRoutes = require('./logRoutes');
const systemLogRoutes = require('./systemLogRoutes');
const systemConfigRoutes = require('./systemConfigRoutes');
const networkRoutes = require('./networkRoutes');
const createUploadRoutes = require('./uploadRoutes');
const createHealthRoutes = require('./healthRoutes');

/**
 * Monta todas las rutas de la aplicación en la instancia de Express
 * @param {Express} app - Instancia de Express
 * @param {Object} context - Contexto compartido (generateId, mockSnmpQuery, etc.)
 * @param {Object} middleware - Middlewares compartidos (requireAuth, requireAdmin, etc.)
 * @param {Object} config - Configuraciones (appConfig, upload, etc.)
 */
function mountRoutes(app, context, middleware, config) {
  const { appConfig, upload } = config;

  // Rutas de salud (sin prefijo /api)
  const healthRouter = createHealthRoutes(appConfig);
  app.use('/', healthRouter);
  app.use('/api', healthRouter);

  // Ruta de upload
  const uploadRouter = createUploadRoutes(upload);
  app.use('/api/upload', uploadRouter);

  // Rutas de autenticación
  app.use('/api/auth', authRoutes(context, middleware));

  // Rutas de usuarios
  app.use('/api/users', userRoutes(context, middleware));

  // Rutas de red (network scanner)
  app.use('/api/network', networkRoutes(middleware));

  // Rutas de impresoras (dos montajes para /printers y /printer)
  const printerRouter = printerRoutes(context, middleware);
  app.use('/api/printers', printerRouter); // GET /, POST /, PUT /:id, DELETE /:id
  app.use('/api/printer', printerRouter);  // POST /sync, POST /supplies

  // Rutas de logs (dos routers en el mismo path)
  app.use('/api/logs', logRoutes(context, middleware));
  app.use('/api/logs', systemLogRoutes(middleware));

  // Rutas de configuración del sistema
  app.use('/api/system/config', systemConfigRoutes(context, middleware));

  // Manejo de errores 404 (debe ser la última ruta)
  app.use((req, res) => {
    res.status(404).json({ error: `Ruta API no encontrada: ${req.url}` });
  });

  console.log('✅ Rutas montadas correctamente');
}

module.exports = mountRoutes;
