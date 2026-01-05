/**
 * Auth Controller
 * Maneja autenticación y autorización de usuarios
 */

const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const { addSystemLog } = require('../utils/logger');
const emailService = require('../services/emailService');
const { isValidEmail } = require('../middleware/validation');

/**
 * Obtiene información del usuario actual
 */
async function getCurrentUser(req, res) {
  if (req.currentUser) {
    return res.json(req.currentUser);
  }
  res.status(401).json({ error: 'No autenticado', requiresLogin: true });
}

/**
 * Login de usuario
 */
async function login(req, res) {
  const { username, password } = req.body;
  
  try {
    // Usar el método authenticate del modelo User
    const user = await User.authenticate(username, password);
    
    if (!user) {
      addSystemLog('warn', 'AUTH', `Intento de login fallido: credenciales inválidas`, username);
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    
    if (user.role === 'PENDING') {
      addSystemLog('info', 'AUTH', `Usuario pendiente intentó acceder`, username);
      return res.status(403).json({ error: 'Cuenta pendiente de aprobación.' });
    }
    
    // Guardar información en la sesión
    req.session.userId = user._id.toString();
    req.session.username = user.username;
    req.session.role = user.role;
    
    addSystemLog('success', 'AUTH', `Usuario ${user.username} inició sesión`, `Rol: ${user.role}`);
    
    // Devolver el usuario sin la contraseña
    res.json({ 
      success: true, 
      message: 'Login exitoso',
      user: user.toJSON() 
    });
  } catch (err) {
    addSystemLog('error', 'AUTH', `Error en login`, err.message);
    res.status(500).json({ error: 'Error en el servidor' });
  }
}

/**
 * Logout de usuario
 */
async function logout(req, res) {
  const username = req.session?.username || 'Usuario desconocido';
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        addSystemLog('error', 'AUTH', `Error al cerrar sesión de ${username}`, err.message);
        return res.status(500).json({ error: 'Error al cerrar sesión' });
      }
      addSystemLog('info', 'AUTH', `Usuario ${username} cerró sesión`);
      res.clearCookie('printmaster.sid'); // Eliminar la cookie
      return res.json({ success: true, message: 'Sesión cerrada correctamente' });
    });
  } else {
    res.json({ success: true, message: 'No hay sesión activa' });
  }
}

/**
 * Registro de nuevo usuario
 */
async function register(req, res) {
  try {
    const { username, password, email, name } = req.body;
    
    // Verificar si el usuario o email ya existen (solo usuarios activos)
    const existingUser = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() }
      ],
      deletedAt: null // Solo verificar en usuarios activos
    });
    
    if (existingUser) {
      const field = existingUser.username === username.toLowerCase() ? 'username' : 'email';
      addSystemLog('warn', 'AUTH', `Intento de registro con ${field} duplicado`, username);
      return res.status(400).json({ 
        error: `El ${field === 'username' ? 'nombre de usuario' : 'email'} ya está registrado` 
      });
    }
    
    // Crear nuevo usuario (el password se hasheará automáticamente en el pre-save hook)
    const newUser = new User({ 
      username: username.toLowerCase(),
      password, // Se hasheará automáticamente
      email: email.toLowerCase(),
      name: name || username,
      role: 'PENDING' // Por defecto pendiente de aprobación
    });
    
    await newUser.save();
    
    addSystemLog('info', 'AUTH', `Nuevo usuario registrado: ${newUser.username}`, `Email: ${newUser.email}`);
    
    // Enviar email de bienvenida
    try {
      await emailService.sendWelcomeEmail(newUser.email, newUser.name || newUser.username);
      addSystemLog('success', 'AUTH', `Email de bienvenida enviado a ${newUser.email}`);
    } catch (emailError) {
      // No fallar el registro si el email falla
      addSystemLog('warn', 'EMAIL', `Error enviando email de bienvenida`, emailError.message);
    }
    
    res.status(201).json({ 
      success: true,
      message: 'Usuario registrado exitosamente. Pendiente de aprobación por un administrador.',
      user: newUser.toJSON()
    });
  } catch (err) {
    addSystemLog('error', 'AUTH', `Error en registro de usuario`, err.message);
    
    // Manejar errores de validación de Mongoose
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ error: 'Errores de validación', errors });
    }
    
    res.status(500).json({ error: 'Error en el servidor al registrar usuario' });
  }
}

/**
 * Solicitud de recuperación de contraseña
 * Genera un token y envía email con enlace de recuperación
 */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    
    // Buscar usuario por email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    // Por seguridad, siempre devolver el mismo mensaje
    // No revelar si el email existe o no
    const successMessage = 'Si el email está registrado, recibirás un enlace de recuperación';
    
    if (!user) {
      addSystemLog('info', 'AUTH', `Solicitud de recuperación para email no registrado`, email);
      return res.json({ success: true, message: successMessage });
    }
    
    // Generar token de recuperación
    const resetToken = await PasswordResetToken.createForUser(user._id);
    
    // Construir URL de recuperación (ajustar según tu frontend)
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken.token}`;
    
    // Enviar email
    try {
      await emailService.sendPasswordResetEmail(
        user,
        resetUrl
      );
      
      addSystemLog('success', 'AUTH', `Email de recuperación enviado a ${user.email}`);
    } catch (emailError) {
      addSystemLog('error', 'EMAIL', `Error enviando email de recuperación`, emailError.message);
      return res.status(500).json({ 
        error: 'Error al enviar el email de recuperación. Inténtalo más tarde.' 
      });
    }
    
    res.json({ success: true, message: successMessage });
  } catch (err) {
    addSystemLog('error', 'AUTH', `Error en solicitud de recuperación`, err.message);
    res.status(500).json({ error: 'Error en el servidor' });
  }
}

/**
 * Verificar validez de token de recuperación
 * Endpoint GET para verificar antes de mostrar el formulario
 */
async function verifyResetToken(req, res) {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({ error: 'Token no proporcionado', valid: false });
    }
    
    // Validar token
    const resetToken = await PasswordResetToken.validateToken(token);
    
    if (!resetToken) {
      return res.status(400).json({ 
        error: 'Token inválido, expirado o ya utilizado', 
        valid: false 
      });
    }
    
    res.json({ 
      valid: true, 
      message: 'Token válido',
      expiresAt: resetToken.expiresAt
    });
  } catch (err) {
    addSystemLog('error', 'AUTH', `Error verificando token`, err.message);
    res.status(500).json({ error: 'Error en el servidor', valid: false });
  }
}

/**
 * Restablecer contraseña con token
 */
async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;
    
    // Validar token
    const resetToken = await PasswordResetToken.validateToken(token);
    
    if (!resetToken) {
      addSystemLog('warn', 'AUTH', `Intento de reset con token inválido`);
      return res.status(400).json({ 
        error: 'Token inválido, expirado o ya utilizado' 
      });
    }
    
    // Buscar usuario
    const user = await User.findById(resetToken.userId);
    
    if (!user) {
      addSystemLog('error', 'AUTH', `Usuario no encontrado para token válido`, resetToken.userId);
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Actualizar contraseña (se hasheará automáticamente)
    user.password = newPassword;
    await user.save();
    
    // Marcar token como usado
    resetToken.used = true;
    await resetToken.save();
    
    addSystemLog('success', 'AUTH', `Contraseña restablecida para ${user.username}`);
    
    // Enviar email de confirmación
    try {
      await emailService.sendPasswordChangedEmail(
        user.email,
        user.name || user.username
      );
    } catch (emailError) {
      // No fallar si el email falla
      addSystemLog('warn', 'EMAIL', `Error enviando confirmación de cambio`, emailError.message);
    }
    
    res.json({ 
      success: true, 
      message: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión.' 
    });
  } catch (err) {
    addSystemLog('error', 'AUTH', `Error restableciendo contraseña`, err.message);
    res.status(500).json({ error: 'Error en el servidor' });
  }
}

/**
 * Cambiar contraseña (usuario autenticado)
 */
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.session.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    
    // Buscar usuario
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Verificar contraseña actual
    const isMatch = await user.comparePassword(currentPassword);
    
    if (!isMatch) {
      addSystemLog('warn', 'AUTH', `Intento de cambio de contraseña con contraseña actual incorrecta`, user.username);
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }
    
    // Actualizar contraseña
    user.password = newPassword;
    await user.save();
    
    addSystemLog('success', 'AUTH', `Contraseña cambiada para ${user.username}`);
    
    // Enviar email de confirmación
    try {
      await emailService.sendPasswordChangedEmail(
        user.email,
        user.name || user.username
      );
    } catch (emailError) {
      addSystemLog('warn', 'EMAIL', `Error enviando confirmación de cambio`, emailError.message);
    }
    
    res.json({ 
      success: true, 
      message: 'Contraseña cambiada exitosamente' 
    });
  } catch (err) {
    addSystemLog('error', 'AUTH', `Error cambiando contraseña`, err.message);
    res.status(500).json({ error: 'Error en el servidor' });
  }
}

/**
 * Enviar email de recuperación a un usuario (Admin only)
 * Similar a forgotPassword pero el admin lo dispara para otro usuario
 */
async function sendPasswordRecovery(req, res) {
  try {
    const { userId } = req.body;
    
    // Buscar usuario por ID (solo usuarios activos)
    const user = await User.findOne({ _id: userId, deletedAt: null });
    
    if (!user) {
      addSystemLog('warn', 'AUTH', `Admin intentó enviar recuperación a usuario inexistente`, userId);
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // No enviar a usuarios pendientes
    if (user.role === 'PENDING') {
      return res.status(400).json({ error: 'No se puede enviar recuperación a usuarios pendientes' });
    }
    
    // Generar token de recuperación
    const resetToken = await PasswordResetToken.createForUser(user._id);
    
    // Construir URL de recuperación
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken.token}`;
    
    // Enviar email
    try {
      await emailService.sendPasswordResetEmail(
        user,
        resetUrl
      );
      
      addSystemLog('success', 'AUTH', `Admin envió email de recuperación a ${user.email}`, req.session.username);
      
      res.json({ 
        success: true, 
        message: `Email de recuperación enviado a ${user.email}` 
      });
    } catch (emailError) {
      addSystemLog('error', 'EMAIL', `Error enviando email de recuperación`, emailError.message);
      return res.status(500).json({ 
        error: 'Error al enviar el email de recuperación. Verifica la configuración de email.' 
      });
    }
  } catch (err) {
    addSystemLog('error', 'AUTH', `Error en envío de recuperación por admin`, err.message);
    res.status(500).json({ error: 'Error en el servidor' });
  }
}

module.exports = {
  getCurrentUser,
  login,
  logout,
  register,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  changePassword,
  sendPasswordRecovery
};
