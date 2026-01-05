/**
 * Middleware de validación para operaciones de usuarios
 */

const { addSystemLog } = require('../utils/logger');

/**
 * Valida razón de rechazo
 */
function validateRejection(req, res, next) {
  const { reason } = req.body;
  
  if (!reason || reason.trim().length === 0) {
    return res.status(400).json({ 
      error: 'La razón del rechazo es requerida',
      field: 'reason'
    });
  }
  
  if (reason.trim().length < 10) {
    return res.status(400).json({ 
      error: 'La razón debe tener al menos 10 caracteres',
      field: 'reason'
    });
  }
  
  if (reason.length > 500) {
    return res.status(400).json({ 
      error: 'La razón no puede exceder 500 caracteres',
      field: 'reason'
    });
  }
  
  req.body.reason = reason.trim();
  next();
}

/**
 * Valida rol de usuario
 */
function validateRole(req, res, next) {
  const { role } = req.body;
  const validRoles = ['ADMIN', 'TECHNICIAN', 'PENDING'];
  
  if (!role) {
    return res.status(400).json({ 
      error: 'El rol es requerido',
      field: 'role'
    });
  }
  
  if (!validRoles.includes(role)) {
    return res.status(400).json({ 
      error: `Rol inválido. Valores permitidos: ${validRoles.join(', ')}`,
      field: 'role',
      validRoles
    });
  }
  
  next();
}

/**
 * Valida que el usuario no se elimine a sí mismo
 */
function preventSelfDeletion(req, res, next) {
  const { id } = req.params;
  const currentUserId = req.session.userId;
  
  if (id === currentUserId) {
    addSystemLog('warn', 'USERS', `Intento de auto-eliminación bloqueado`, req.session.username);
    return res.status(403).json({ 
      error: 'No puedes eliminar tu propia cuenta',
      message: 'Por seguridad, no está permitido que un administrador elimine su propia cuenta'
    });
  }
  
  next();
}

/**
 * Valida que el usuario no cambie su propio rol
 */
function preventSelfRoleChange(req, res, next) {
  const { id } = req.params;
  const currentUserId = req.session.userId;
  
  if (id === currentUserId) {
    addSystemLog('warn', 'USERS', `Intento de auto-cambio de rol bloqueado`, req.session.username);
    return res.status(403).json({ 
      error: 'No puedes cambiar tu propio rol',
      message: 'Por seguridad, no está permitido que un administrador modifique su propio rol'
    });
  }
  
  next();
}

/**
 * Requiere que el usuario sea ADMIN
 */
function requireAdmin(req, res, next) {
  const userRole = req.session.userRole;
  
  if (userRole !== 'ADMIN') {
    addSystemLog('warn', 'AUTH', `Acceso denegado a ${req.path}`, req.session.username || 'Anónimo');
    return res.status(403).json({ 
      error: 'Acceso denegado',
      message: 'Esta acción requiere privilegios de administrador'
    });
  }
  
  next();
}

module.exports = {
  validateRejection,
  validateRole,
  preventSelfDeletion,
  preventSelfRoleChange,
  requireAdmin
};
