/**
 * Database Configuration
 * Configuración y conexión a MongoDB
 */

const mongoose = require('mongoose');
const appConfig = require('./app.config');
const logger = require('../utils/logger');

/**
 * Conecta a MongoDB y ejecuta inicializaciones
 */
async function connectDatabase() {
  console.log('⏳ Intentando conectar a Base de Datos...');
  
  try {
    await mongoose.connect(appConfig.mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    const isAtlas = appConfig.mongoUri.includes('mongodb.net');
    console.log(`✅ Conectado a MongoDB ${isAtlas ? '(ATLAS CLOUD)' : '(LOCAL)'}`);
    logger.addSystemLog('success', 'DATABASE', `Conectado a MongoDB ${isAtlas ? '(ATLAS CLOUD)' : '(LOCAL)'}`);
    
    // await runAllMigrations(); // ✅ Migraciones ya completadas
    
    return true;
  } catch (err) {
    console.error('❌ ERROR FATAL: No se pudo conectar a MongoDB');
    console.error(`   Detalle: ${err.message}`);
    console.error(`   URI: ${appConfig.mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')}`);
    console.error('   Asegúrate de que MongoDB esté corriendo: mongod o net start MongoDB');
    console.error('\n   El servidor no puede funcionar sin MongoDB.');
    logger.addSystemLog('error', 'DATABASE', 'MongoDB no disponible - Servidor no operativo', err.message);
    process.exit(1);
  }
}

module.exports = {
  connectDatabase
};
