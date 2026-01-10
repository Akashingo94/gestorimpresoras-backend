/**
 * Script para promover un usuario a ADMIN
 * Uso: node scripts/promote-to-admin.js email@ejemplo.com
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const promoteToAdmin = async (email) => {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    // Buscar usuario
    const user = await User.findOne({ email });
    
    if (!user) {
      console.error(`❌ Usuario con email "${email}" no encontrado`);
      process.exit(1);
    }

    console.log(`\n📋 Usuario encontrado:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Rol actual: ${user.role}`);

    // Actualizar rol
    user.role = 'ADMIN';
    await user.save();

    console.log(`\n✅ Usuario promovido a ADMIN exitosamente`);
    console.log(`\n🔄 Por favor, cierra sesión y vuelve a ingresar para que los cambios surtan efecto.`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

// Obtener email desde argumentos
const email = process.argv[2];

if (!email) {
  console.error('❌ Debes proporcionar un email');
  console.log('\nUso: node scripts/promote-to-admin.js email@ejemplo.com');
  process.exit(1);
}

promoteToAdmin(email);
