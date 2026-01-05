/**
 * Validation Middleware
 * Middleware para validación de datos de entrada
 */

const { addSystemLog } = require('../utils/logger');

/**
 * Valida email
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida contraseña
 * Mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número
 */
function isValidPassword(password) {
  return password && password.length >= 8;
}

/**
 * Valida username
 * Debe ser un email válido o username alfanumérico
 */
function isValidUsername(username) {
  if (!username || username.length < 3) return false;
  // Permitir emails o usernames alfanuméricos
  return isValidEmail(username) || /^[a-zA-Z0-9_.-]+$/.test(username);
}

/**
 * Middleware: Valida datos de registro
 */
function validateRegistration(req, res, next) {
  const { username, password, email, name } = req.body;
  const errors = [];
  
  // Validar username
  if (!username || username.trim().length === 0) {
    errors.push('El username es requerido');
  } else if (!isValidUsername(username)) {
    errors.push('Username inválido. Debe ser un email o alfanumérico (mínimo 3 caracteres)');
  }
  
  // Validar password
  if (!password || password.length === 0) {
    errors.push('La contraseña es requerida');
  } else if (!isValidPassword(password)) {
    errors.push('La contraseña debe tener al menos 8 caracteres');
  }
  
  // Validar email (requerido)
  if (!email || email.trim().length === 0) {
    errors.push('El email es requerido');
  } else if (!isValidEmail(email)) {
    errors.push('Email inválido');
  }
  
  // Validar nombre (opcional pero si se proporciona, validar)
  if (name && name.trim().length < 2) {
    errors.push('El nombre debe tener al menos 2 caracteres');
  }
  
  if (errors.length > 0) {
    addSystemLog('warn', 'VALIDATION', 'Errores en validación de registro', errors.join(', '));
    return res.status(400).json({ 
      error: 'Errores de validación',
      errors 
    });
  }
  
  // Sanitizar datos
  req.body.username = username.trim().toLowerCase();
  req.body.email = email.trim().toLowerCase();
  if (name) req.body.name = name.trim();
  
  next();
}

/**
 * Middleware: Valida datos de login
 */
function validateLogin(req, res, next) {
  const { username, password } = req.body;
  const errors = [];
  
  if (!username || username.trim().length === 0) {
    errors.push('El username es requerido');
  }
  
  if (!password || password.length === 0) {
    errors.push('La contraseña es requerida');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ 
      error: 'Errores de validación',
      errors 
    });
  }
  
  next();
}

/**
 * Middleware: Valida email para recuperación
 */
function validatePasswordResetRequest(req, res, next) {
  const { email } = req.body;
  
  if (!email || email.trim().length === 0) {
    return res.status(400).json({ error: 'El email es requerido' });
  }
  
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Email inválido' });
  }
  
  req.body.email = email.trim().toLowerCase();
  next();
}

/**
 * Middleware: Valida token y nueva contraseña
 */
function validatePasswordReset(req, res, next) {
  const { token, newPassword } = req.body;
  const errors = [];
  
  if (!token || token.trim().length === 0) {
    errors.push('El token es requerido');
  }
  
  if (!newPassword || newPassword.length === 0) {
    errors.push('La nueva contraseña es requerida');
  } else if (newPassword.length < 4) {
    errors.push('La contraseña debe tener al menos 4 caracteres');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ 
      error: 'Errores de validación',
      errors 
    });
  }
  
  next();
}

/**
 * Middleware: Valida cambio de contraseña
 */
function validatePasswordChange(req, res, next) {
  const { currentPassword, newPassword } = req.body;
  const errors = [];
  
  if (!currentPassword || currentPassword.length === 0) {
    errors.push('La contraseña actual es requerida');
  }
  
  if (!newPassword || newPassword.length === 0) {
    errors.push('La nueva contraseña es requerida');
  } else if (!isValidPassword(newPassword)) {
    errors.push('La nueva contraseña debe tener al menos 8 caracteres');
  }
  
  if (currentPassword === newPassword) {
    errors.push('La nueva contraseña debe ser diferente a la actual');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ 
      error: 'Errores de validación',
      errors 
    });
  }
  
  next();
}

module.exports = {
  validateRegistration,
  validateLogin,
  validatePasswordResetRequest,
  validatePasswordReset,
  validatePasswordChange,
  isValidEmail,
  isValidPassword,
  isValidUsername
};
