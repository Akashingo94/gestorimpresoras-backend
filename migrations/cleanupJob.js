/**
 * Cleanup Job
 * Script para ejecutar tareas de limpieza periódicas
 * Ejecutar con: node migrations/cleanupJob.js
 */

const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const UserSession = require('../models/UserSession');

require('dotenv').config();

async function runCleanup() {
  try {
    console.log('🧹 Iniciando limpieza automática...');
    console.log('');
    
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/printmaster_db');
    console.log('✅ Conectado a MongoDB');
    console.log('');
    
    // Limpiar notificaciones antiguas (leídas y más de 30 días)
    console.log('📬 Limpiando notificaciones antiguas...');
    const notifResult = await Notification.cleanupOldNotifications();
    console.log(`   ✓ ${notifResult.deletedCount} notificaciones eliminadas`);
    console.log('');
    
    // Limpiar sesiones inactivas (más de 7 días)
    console.log('🔐 Limpiando sesiones inactivas...');
    const sessionResult = await UserSession.cleanupInactiveSessions();
    console.log(`   ✓ ${sessionResult.deletedCount} sesiones eliminadas`);
    console.log('');
    
    // Estadísticas finales
    const totalNotifications = await Notification.countDocuments({});
    const totalSessions = await UserSession.countDocuments({});
    
    console.log('📊 Estado actual:');
    console.log(`   - Notificaciones activas: ${totalNotifications}`);
    console.log(`   - Sesiones activas: ${totalSessions}`);
    console.log('');
    
    console.log('✅ Limpieza completada exitosamente');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error en la limpieza:', error);
    process.exit(1);
  }
}

// Ejecutar limpieza
runCleanup();
