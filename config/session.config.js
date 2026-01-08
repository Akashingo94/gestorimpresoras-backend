/**
 * Session Configuration
 * Configuración de express-session con MongoDB Store
 */

const session = require('express-session');
const MongoStore = require('connect-mongo').default || require('connect-mongo');
const mongoose = require('mongoose');
const appConfig = require('./app.config');

/**
 * Crea la configuración de sesión con MongoDB Store
 * Usa la conexión existente de mongoose
 */
function createSessionConfig() {
  return {
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
    store: new MongoStore({
      mongoUrl: appConfig.mongoUri,
      touchAfter: 24 * 3600
    })
  };
}

module.exports = createSessionConfig;
