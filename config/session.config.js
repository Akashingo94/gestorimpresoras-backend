/**
 * Session Configuration
 * Configuración de express-session con MongoDB Store
 */

const session = require('express-session');
const MongoStore = require('connect-mongo');
const appConfig = require('./app.config');

/**
 * Crea la configuración de sesión con MongoDB Store
 */
function createSessionConfig() {
  const sessionConfig = {
    secret: appConfig.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: appConfig.isProduction,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
      sameSite: 'lax'
    },
    name: 'printmaster.sid',
    // connect-mongo v6 - se usa como función directa
    store: MongoStore(session)({
      mongoUrl: appConfig.mongoUri,
      touchAfter: 24 * 3600,
      crypto: { secret: appConfig.sessionSecret }
    })
  };
  
  console.log('✅ Sesiones configuradas con MongoDB Store');

  return sessionConfig;
}

module.exports = createSessionConfig;
