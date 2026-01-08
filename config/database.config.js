/**
 * Database Configuration
 * Configuración y conexión a MongoDB con auto-reconexión
 */

const mongoose = require('mongoose');
const appConfig = require('./app.config');
const logger = require('../utils/logger');

// Estado global de la conexión
let isConnected = false;
let reconnectAttempt = 0;
const MAX_RECONNECT_ATTEMPTS = Infinity; // Reintentar siempre
const RECONNECT_INTERVAL = 5000; // 5 segundos

/**
 * Verifica si MongoDB está conectado
 */
function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Intenta reconectar a MongoDB con backoff exponencial
 */
async function attemptReconnection() {
  if (isDatabaseConnected()) {
    console.log('✅ MongoDB ya está conectado');
    return true;
  }

  reconnectAttempt++;
  const delay = Math.min(RECONNECT_INTERVAL * Math.pow(1.5, reconnectAttempt - 1), 30000);
  
  console.log(`🔄 Reintento de conexión #${reconnectAttempt} en ${delay/1000}s...`);
  
  await new Promise(resolve => setTimeout(resolve, delay));
  
  try {
    await mongoose.connect(appConfig.mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    return true;
  } catch (err) {
    console.error(`❌ Reintento #${reconnectAttempt} fallido: ${err.message}`);
    return false;
  }
}

/**
 * Configura listeners de eventos de MongoDB
 */
function setupMongooseListeners() {
  mongoose.connection.on('connected', () => {
    isConnected = true;
    reconnectAttempt = 0;
    const isAtlas = appConfig.mongoUri.includes('mongodb.net');
    console.log(`✅ Conectado a MongoDB ${isAtlas ? '(ATLAS CLOUD)' : '(LOCAL)'}`);
    logger.addSystemLog('success', 'DATABASE', `Conectado a MongoDB ${isAtlas ? '(ATLAS CLOUD)' : '(LOCAL)'}`);
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.warn('⚠️ MongoDB desconectado. Intentando reconectar...');
    logger.addSystemLog('warn', 'DATABASE', 'MongoDB desconectado - Iniciando reconexión');
    startReconnectionLoop();
  });

  mongoose.connection.on('error', (err) => {
    console.error(`❌ Error de MongoDB: ${err.message}`);
    logger.addSystemLog('error', 'DATABASE', 'Error de conexión MongoDB', err.message);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    try {
      await mongoose.connection.close();
      console.log('✅ Conexión MongoDB cerrada correctamente');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error al cerrar conexión:', err);
      process.exit(1);
    }
  });
}

/**
 * Loop de reconexión automática
 */
async function startReconnectionLoop() {
  while (!isDatabaseConnected() && reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
    const success = await attemptReconnection();
    if (success) {
      console.log(`✅ Reconectado a MongoDB exitosamente después de ${reconnectAttempt} intentos`);
      logger.addSystemLog('success', 'DATABASE', `Reconexión exitosa después de ${reconnectAttempt} intentos`);
      break;
    }
  }
}

/**
 * Conecta a MongoDB con manejo de errores profesional
 * NO CRASHEA el servidor si falla la conexión inicial
 */
async function connectDatabase() {
  console.log('⏳ Intentando conectar a Base de Datos...');
  
  // Configurar listeners primero
  setupMongooseListeners();
  
  try {
    await mongoose.connect(appConfig.mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    return true;
  } catch (err) {
    console.error('❌ ERROR: No se pudo conectar a MongoDB (intento inicial)');
    console.error(`   Detalle: ${err.message}`);
    console.error(`   URI: ${appConfig.mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')}`);
    console.warn('⚠️  El servidor iniciará en MODO DEGRADADO');
    console.warn(`⚠️  Se intentará reconectar automáticamente cada ${RECONNECT_INTERVAL/1000}s`);
    console.warn('   Asegúrate de que MongoDB esté corriendo: mongod o net start MongoDB\n');
    
    logger.addSystemLog('error', 'DATABASE', 'MongoDB no disponible - Modo degradado activado', err.message);
    
    // NO crashear - iniciar loop de reconexión
    startReconnectionLoop();
    
    return false;
  }
}

module.exports = {
  connectDatabase,
  isDatabaseConnected
};
