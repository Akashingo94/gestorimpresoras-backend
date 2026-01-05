/**
 * Session Configuration
 * Configuración de express-session
 */

const MongoStore = require('connect-mongo');
const appConfig = require('./app.config');

/**
 * Crea la configuración de sesión con MongoDB Store
 */
function createSessionConfig() {
  const sessionConfig = {
    secret: appConfig.sessionSecret,
    resave: false,
    saveUninitialized: false, // No crear sesión hasta que algo se almacene
    cookie: {
      secure: appConfig.isProduction, // true en producción con HTTPS
      httpOnly: true, // La cookie no es accesible desde JavaScript del cliente
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
      sameSite: 'lax' // Protección CSRF
    },
    name: 'printmaster.sid' // Nombre personalizado de la cookie
  };

  // Intentar configurar MongoDB Store
  try {
    sessionConfig.store = MongoStore.create({
      mongoUrl: appConfig.mongoUri,
      touchAfter: 24 * 3600, // Actualizar sesión cada 24 horas si no hay cambios
      crypto: {
        secret: appConfig.sessionSecret
      }
    });
    console.log('✅ Sesiones configuradas con MongoDB Store');
  } catch (error) {
    console.log('⚠️ MongoDB Store no disponible, usando MemoryStore (las sesiones se perderán al reiniciar)');
  }

  return sessionConfig;
}

module.exports = createSessionConfig;
