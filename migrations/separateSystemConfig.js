/**
 * Migración: Separar configuración del sistema de preferencias de usuario
 * 
 * Antes: User.preferences contenía tema + logo + configuración del sistema
 * Ahora: 
 *   - User.preferences: solo tema y fuentes (personal)
 *   - SystemConfig: logo y configuración del sistema (global)
 * 
 * Ejecutar: node migrations/separateSystemConfig.js
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const SystemConfig = require('../models/SystemConfig');
const appConfig = require('../config/app.config');

async function migrate() {
  try {
    console.log('🔄 Iniciando migración de configuración del sistema...\n');

    // Conectar a MongoDB
    await mongoose.connect(appConfig.mongoUri);
    console.log('✅ Conectado a MongoDB\n');

    // 1. Obtener o crear configuración del sistema
    let systemConfig = await SystemConfig.findOne();
    
    if (!systemConfig) {
      // Intentar obtener configuración del sistema desde el primer admin
      const adminUser = await User.findOne({ role: 'ADMIN' }).sort({ createdAt: 1 });
      
      if (adminUser?.preferences?.system) {
        console.log(`📋 Configuración encontrada en usuario admin: ${adminUser.username}`);
        systemConfig = await SystemConfig.create({
          logoJson: adminUser.preferences.system.logoJson || null,
          logoSize: adminUser.preferences.system.logoSize || 120,
          appName: adminUser.preferences.system.appName || 'GestorImpresoras',
          appVersion: adminUser.preferences.system.appVersion || 'Enterprise v2.0',
          companyName: adminUser.preferences.system.companyName || 'GestorImpresoras Enterprise',
          footerText: adminUser.preferences.system.footerText || 'Sistemas e Infraestructura',
          copyrightYear: adminUser.preferences.system.copyrightYear || '2025',
          copyrightCompany: adminUser.preferences.system.copyrightCompany || 'California S.A.'
        });
        console.log('✅ Configuración del sistema creada desde usuario admin\n');
      } else {
        // Crear con valores por defecto
        systemConfig = await SystemConfig.create({});
        console.log('✅ Configuración del sistema creada con valores por defecto\n');
      }
    } else {
      console.log('ℹ️ Configuración del sistema ya existe\n');
    }

    // 2. Limpiar campo system de preferences en todos los usuarios
    const users = await User.find({ 'preferences.system': { $exists: true } });
    
    if (users.length > 0) {
      console.log(`🔧 Limpiando campo 'system' de ${users.length} usuarios...\n`);
      
      for (const user of users) {
        // Remover el campo system de preferences
        if (user.preferences.system) {
          delete user.preferences.system;
          
          // Asegurar que tiene valores por defecto para tema y fuentes
          if (!user.preferences.themeColor) {
            user.preferences.themeColor = {
              id: 'green',
              name: 'Verde Esmeralda',
              hex: '#10b981',
              twClass: 'emerald'
            };
          }
          if (!user.preferences.fontFamily) {
            user.preferences.fontFamily = 'Inter';
          }
          if (!user.preferences.fontSize) {
            user.preferences.fontSize = 'Normal';
          }
          
          await user.save();
          console.log(`  ✅ ${user.username} - Preferencias actualizadas`);
        }
      }
      console.log('\n✅ Todos los usuarios migrados correctamente\n');
    } else {
      console.log('ℹ️ No hay usuarios con configuración del sistema en preferences\n');
    }

    // 3. Resumen
    console.log('📊 Resumen de la migración:');
    console.log(`   - Configuración del sistema: ${systemConfig ? 'Creada/Existente' : 'Error'}`);
    console.log(`   - Usuarios actualizados: ${users.length}`);
    console.log(`   - Logo del sistema: ${systemConfig.logoJson ? 'Configurado' : 'Sin configurar'}`);
    console.log('');
    console.log('✅ Migración completada exitosamente\n');

    await mongoose.connection.close();
    console.log('🔌 Conexión cerrada');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

migrate();
