/**
 * Authentication Middleware
 * Middlewares para autenticación y autorización
 */

const User = require('../models/User');

/**
 * Middleware: Verificar autenticación
 * Bloquea acceso si no hay sesión activa
 */
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ 
      error: 'No autenticado', 
      requiresLogin: true,
      message: 'Se requiere iniciar sesión para acceder a este recurso'
    });
  }
  next();
};

/**
 * Middleware: Verificar rol de administrador
 * Solo permite acceso a usuarios con rol ADMIN
 */
const requireAdmin = (req, res, next) => {
  console.log('🔐 [requireAdmin] Verificando acceso...');
  console.log('   Session ID:', req.sessionID);
  console.log('   Session:', req.session);
  console.log('   Cookies:', req.headers.cookie);
  console.log('   User Agent:', req.headers['user-agent']?.substring(0, 50));
  
  if (!req.session || !req.session.userId) {
    console.log('   ❌ Sin sesión - 401');
    return res.status(401).json({ 
      error: 'No autenticado', 
      requiresLogin: true,
      debug: process.env.NODE_ENV === 'development' ? {
        hasSession: !!req.session,
        sessionId: req.sessionID,
        hasCookie: !!req.headers.cookie
      } : undefined
    });
  }
  
  if (req.session.role !== 'ADMIN') {
    console.log('   ❌ No es ADMIN - 403. Rol actual:', req.session.role);
    return res.status(403).json({ 
      error: 'Acceso denegado', 
      message: 'Se requieren permisos de administrador' 
    });
  }
  
  console.log('   ✅ Acceso permitido -', req.session.username);
  next();
};

/**
 * Middleware: Adjuntar usuario actual al request
 * Carga información del usuario desde MongoDB
 */
const attachUser = async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const user = await User.findById(req.session.userId);
      if (user) {
        req.currentUser = user.toJSON();
      }
    } catch (err) {
      console.error('Error al obtener usuario de sesión:', err);
    }
  }
  next();
};

/**
 * Middleware combinado: Autenticación + Usuario
 * Requiere autenticación y adjunta datos del usuario
 */
const authMiddleware = [requireAuth, attachUser];

module.exports = () => ({
  requireAuth,
  requireAdmin,
  attachUser,
  authMiddleware
});
