/**
 * Application Configuration
 * Configuración general de la aplicación
 */

module.exports = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/printmaster_db',
  sessionSecret: process.env.SESSION_SECRET || 'gestorimpresoras-secret-change-in-production-2024',
  
  // Entorno
  env: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Límites
  jsonLimit: '50mb',
  fileUploadLimit: 2 * 1024 * 1024 * 1024, // 2GB
};
