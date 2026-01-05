#!/usr/bin/env node
/**
 * Script de migración de usuarios
 * Actualiza credenciales antiguas a las nuevas estándar
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/printmaster_db';

const UserSchema = new mongoose.Schema({
    username: String,
    password: String,
    name: String,
    role: String,
    email: String
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

console.log('\n🔄 MIGRACIÓN DE USUARIOS\n');
console.log('━'.repeat(60));

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(async () => {
    console.log('✅ Conectado a MongoDB\n');
    
    // Buscar usuarios con credenciales antiguas
    const oldUsers = await User.find({
      $or: [
        { username: 'admin' },
        { email: 'admin@gestorimpresoras.com' },
        { email: 'admin@printmaster.com' },
        { email: 'admin@local.com' }
      ]
    });
    
    if (oldUsers.length === 0) {
      console.log('ℹ️  No se encontraron usuarios con credenciales antiguas');
      console.log('   Verificando usuario estándar...\n');
      
      const standardUser = await User.findOne({ username: 'admin@printmaster.local' });
      if (standardUser) {
        console.log('✅ Usuario estándar ya existe:');
        console.log(`   Username: ${standardUser.username}`);
        console.log(`   Email: ${standardUser.email}`);
        console.log(`   Role: ${standardUser.role}\n`);
      } else {
        console.log('⚠️  Usuario estándar no existe. Creando...\n');
        await User.create({
          username: 'admin@printmaster.local',
          password: 'admin123',
          name: 'Super Administrador',
          role: 'ADMIN',
          email: 'admin@printmaster.local'
        });
        console.log('✅ Usuario creado:');
        console.log('   Username: admin@printmaster.local');
        console.log('   Password: admin123');
        console.log('   Email: admin@printmaster.local\n');
      }
    } else {
      console.log(`📋 Encontrados ${oldUsers.length} usuario(s) con credenciales antiguas:\n`);
      
      for (const user of oldUsers) {
        console.log(`   Usuario actual:`);
        console.log(`   - Username: ${user.username}`);
        console.log(`   - Email: ${user.email}`);
        console.log(`   - Role: ${user.role}`);
        
        // Actualizar a credenciales estándar
        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              username: 'admin@printmaster.local',
              password: 'admin123',
              email: 'admin@printmaster.local',
              name: user.name || 'Super Administrador'
            }
          }
        );
        
        console.log(`   ✅ Actualizado a:`);
        console.log(`   - Username: admin@printmaster.local`);
        console.log(`   - Password: admin123`);
        console.log(`   - Email: admin@printmaster.local\n`);
      }
    }
    
    // Verificar resultado final
    const finalUsers = await User.find({}, 'username email role');
    console.log('━'.repeat(60));
    console.log(`\n✅ MIGRACIÓN COMPLETADA\n`);
    console.log(`👥 Usuarios en la base de datos (${finalUsers.length}):\n`);
    finalUsers.forEach(user => {
      console.log(`   - ${user.username} (${user.role}) - ${user.email}`);
    });
    
    console.log('\n🔑 Credenciales para acceder al sistema:\n');
    console.log('   Usuario: admin@printmaster.local');
    console.log('   Contraseña: admin123\n');
    console.log('💡 Ahora puedes iniciar el servidor con: node server.js\n');
    
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.log('❌ ERROR DE CONEXIÓN\n');
    console.log(`   ${err.message}\n`);
    process.exit(1);
  });
