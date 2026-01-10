/**
 * Session Controller
 * Gestión del estado de sesión del usuario en el servidor
 */

const UserSession = require('../models/UserSession');

/**
 * Obtener el estado de sesión del usuario actual
 */
async function getSession(req, res) {
  try {
    let session = await UserSession.findOne({ userId: req.session.userId });
    
    if (!session) {
      // Crear sesión inicial si no existe
      session = new UserSession({
        userId: req.session.userId,
        selectedPrinterId: null,
        searchTerm: '',
        viewPreferences: {
          showNetworkScanner: false,
          showSystemLogs: false,
          isMobileSidebarOpen: false
        }
      });
      await session.save();
    }
    
    res.json(session);
  } catch (error) {
    console.error('Error obteniendo sesión:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Actualizar el estado de sesión
 */
async function updateSession(req, res) {
  try {
    const updates = req.body;
    
    let session = await UserSession.findOne({ userId: req.session.userId });
    
    if (!session) {
      session = new UserSession({
        userId: req.session.userId,
        ...updates
      });
    } else {
      // Actualizar solo los campos proporcionados
      Object.keys(updates).forEach(key => {
        if (key === 'viewPreferences' && updates.viewPreferences) {
          session.viewPreferences = {
            ...session.viewPreferences,
            ...updates.viewPreferences
          };
        } else {
          session[key] = updates[key];
        }
      });
    }
    
    await session.save();
    res.json(session);
  } catch (error) {
    console.error('Error actualizando sesión:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Limpiar estado de sesión (logout)
 */
async function clearSession(req, res) {
  try {
    await UserSession.findOneAndDelete({ userId: req.session.userId });
    res.json({ message: 'Sesión limpiada' });
  } catch (error) {
    console.error('Error limpiando sesión:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getSession,
  updateSession,
  clearSession
};
