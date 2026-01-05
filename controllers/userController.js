const PRESET_AVATARS = ['printer', 'technician', 'admin', 'settings', 'shapes'];


async function updateProfile(req, res) {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const { name, email, presetAvatar } = req.body;
    if (name) user.name = name;
    if (email) user.email = email;
    
    if (presetAvatar) {
      if (!PRESET_AVATARS.includes(presetAvatar)) {
        return res.status(400).json({ error: 'Avatar predeterminado no válido' });
      }
      user.avatarUrl = `/preset-${presetAvatar}`;
      addSystemLog('info', 'USERS', `Avatar preset "${presetAvatar}" seleccionado para ${user.username}`);
    }
    else if (req.file) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'Tipo de archivo no permitido. Use imágenes (JPEG, PNG, GIF, WebP)' });
      }
      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'El archivo es demasiado grande. Máximo 5MB' });
      }
      user.avatarUrl = `/uploads/avatars/${req.file.filename}`;
      addSystemLog('info', 'USERS', `Avatar personalizado subido para ${user.username}`);
    }
    
    await user.save();
    addSystemLog('success', 'USERS', `Perfil actualizado para ${user.username}`);
    res.json({ success: true, user: user.toJSON() });
  } catch (err) {
    addSystemLog('error', 'USERS', 'Error al actualizar perfil', err.message);
    res.status(500).json({ error: 'Error en el servidor' });
  }
}

async function getPresetAvatars(req, res) {
  try {
    const avatars = PRESET_AVATARS.map(id => ({
      id,
      url: `/preset-${id}`,
      label: {
        printer: 'Impresora',
        technician: 'Técnico',
        admin: 'Administrador',
        settings: 'Configuración',
        shapes: 'Diseño'
      }[id]
    }));
    
    res.json({ success: true, avatars });
  } catch (err) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
}

async function changePassword(req, res) {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const { currentPassword, newPassword } = req.body;
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      addSystemLog('warn', 'AUTH', `Intento de cambio de contraseña con contraseña actual incorrecta`, user.username);
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }
    user.password = newPassword;
    await user.save();
    addSystemLog('success', 'AUTH', `Contraseña cambiada para ${user.username}`);
    res.json({ success: true, message: 'Contraseña cambiada exitosamente' });
  } catch (err) {
    addSystemLog('error', 'AUTH', `Error cambiando contraseña`, err.message);
    res.status(500).json({ error: 'Error en el servidor' });
  }
}

const User = require('../models/User');
const { addSystemLog } = require('../utils/logger');

async function getAllUsers(req, res) {
  try {
    const { includeDeleted } = req.query;
    
    // Por defecto, solo usuarios activos
    const query = includeDeleted === 'true' 
      ? User.find() 
      : User.find().active();
    
    const users = await query.sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    addSystemLog('error', 'USERS', 'Error al listar usuarios', err.message);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Actualiza el rol de un usuario
 * Si el usuario está PENDING, esta acción lo aprueba automáticamente
 */
async function updateUserRole(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    // Solo usuarios activos pueden cambiar de rol
    const user = await User.findOne({ _id: id, deletedAt: null });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado o eliminado' });
    }
    
    const previousRole = user.role;
    user.role = role;
    await user.save();
    
    // Log diferenciado para aprobaciones vs cambios de rol
    if (previousRole === 'PENDING') {
      addSystemLog('success', 'USERS', `Usuario aprobado: ${user.username}`, `Rol asignado: ${role}`);
    } else {
      addSystemLog('success', 'USERS', `Rol actualizado para ${user.username}`, `${previousRole} → ${role}`);
    }
    
    res.json(user);
  } catch (err) {
    addSystemLog('error', 'USERS', 'Error al actualizar rol', err.message);
    res.status(400).json({ error: err.message });
  }
}

/**
 * Rechaza una solicitud de usuario pendiente (soft delete)
 */
async function rejectPendingUser(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Se requiere una razón para rechazar la solicitud' 
      });
    }
    
    const user = await User.rejectPendingUser(id, reason.trim());
    
    addSystemLog('warn', 'USERS', `Solicitud rechazada: ${user.username}`, `Razón: ${reason}`);
    
    res.json({ 
      success: true,
      message: 'Solicitud de usuario rechazada',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        rejectionReason: user.rejectionReason,
        rejectedAt: user.deletedAt
      }
    });
  } catch (err) {
    addSystemLog('error', 'USERS', 'Error al rechazar usuario', err.message);
    res.status(400).json({ error: err.message });
  }
}

/**
 * Elimina permanentemente un usuario (soft delete)
 */
async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const user = await User.findOne({ _id: id, deletedAt: null });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    await user.softDelete(reason || 'Eliminado por administrador');
    
    addSystemLog('warn', 'USERS', `Usuario eliminado: ${user.username}`, reason || 'Sin razón especificada');
    
    res.json({ 
      success: true,
      message: 'Usuario eliminado correctamente'
    });
  } catch (err) {
    addSystemLog('error', 'USERS', 'Error al eliminar usuario', err.message);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Restaura un usuario eliminado
 */
async function restoreUser(req, res) {
  try {
    const { id } = req.params;
    
    const user = await User.restore(id);
    
    addSystemLog('success', 'USERS', `Usuario restaurado: ${user.username}`);
    
    res.json({ 
      success: true,
      message: 'Usuario restaurado correctamente',
      user: user.toJSON()
    });
  } catch (err) {
    addSystemLog('error', 'USERS', 'Error al restaurar usuario', err.message);
    res.status(400).json({ error: err.message });
  }
}

/**
 * Lista usuarios pendientes de aprobación
 */
async function getPendingUsers(req, res) {
  try {
    const pendingUsers = await User.find({ 
      role: 'PENDING',
      deletedAt: null 
    }).sort({ createdAt: -1 });
    
    res.json(pendingUsers);
  } catch (err) {
    addSystemLog('error', 'USERS', 'Error al listar usuarios pendientes', err.message);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Lista usuarios rechazados
 */
async function getRejectedUsers(req, res) {
  try {
    const rejectedUsers = await User.find()
      .deleted()
      .sort({ deletedAt: -1 });
    
    res.json(rejectedUsers);
  } catch (err) {
    addSystemLog('error', 'USERS', 'Error al listar usuarios rechazados', err.message);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAllUsers,
  updateUserRole,
  rejectPendingUser,
  deleteUser,
  restoreUser,
  getPendingUsers,
  getRejectedUsers,
  updateProfile,
  changePassword,
  getPresetAvatars
};
