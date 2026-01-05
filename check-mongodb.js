#!/usr/bin/env node
/**
 * Script de diagnóstico de MongoDB
 * Verifica la conexión a MongoDB y proporciona información detallada
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/printmaster_db';

console.log('\n🔍 DIAGNÓSTICO DE MONGODB\n');
console.log('━'.repeat(60));

// Mostrar configuración (ocultando credenciales)
const sanitizedURI = MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
console.log(`📋 URI configurada: ${sanitizedURI}`);
console.log(`⏱️  Timeout de conexión: 5 segundos`);
console.log('━'.repeat(60) + '\n');

console.log('🔌 Intentando conectar a MongoDB...\n');

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(async () => {
    const isAtlas = MONGO_URI.includes('mongodb.net');
    console.log('✅ ¡CONEXIÓN EXITOSA!\n');
    console.log(`   Tipo: ${isAtlas ? 'MongoDB Atlas (Cloud)' : 'MongoDB Local'}`);
    console.log(`   Host: ${mongoose.connection.host}`);
    console.log(`   Puerto: ${mongoose.connection.port}`);
    console.log(`   Base de datos: ${mongoose.connection.name}`);
    console.log(`   Estado: ${mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconocido'}`);
    
    // Listar colecciones
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`\n📚 Colecciones existentes (${collections.length}):`);
    if (collections.length > 0) {
      collections.forEach(col => console.log(`   - ${col.name}`));
    } else {
      console.log('   (No hay colecciones aún)');
    }
    
    // Verificar usuarios
    const User = mongoose.model('User', new mongoose.Schema({
      username: String,
      role: String,
      email: String
    }));
    
    const users = await User.find({}, 'username role email');
    console.log(`\n👥 Usuarios en la base de datos (${users.length}):`);
    if (users.length > 0) {
      users.forEach(user => console.log(`   - ${user.username} (${user.role}) - ${user.email}`));
    } else {
      console.log('   (No hay usuarios registrados)');
    }
    
    console.log('\n✅ El sistema puede usar MongoDB correctamente.');
    console.log('\n💡 Puedes iniciar el servidor con: node server.js\n');
    
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.log('❌ ERROR DE CONEXIÓN\n');
    console.log(`   Tipo de error: ${err.name}`);
    console.log(`   Mensaje: ${err.message}`);
    
    console.log('\n🔧 POSIBLES SOLUCIONES:\n');
    
    if (err.message.includes('ECONNREFUSED')) {
      console.log('1. MongoDB no está corriendo. Iniciar el servicio:');
      console.log('   Windows:   net start MongoDB');
      console.log('   Linux:     sudo systemctl start mongod');
      console.log('   Mac:       brew services start mongodb-community');
      console.log('');
      console.log('2. Verificar que MongoDB esté instalado:');
      console.log('   https://www.mongodb.com/try/download/community');
    } else if (err.message.includes('Authentication failed')) {
      console.log('1. Credenciales incorrectas en MONGO_URI');
      console.log('2. Verificar usuario y contraseña en .env');
    } else if (err.message.includes('querySrv ENOTFOUND')) {
      console.log('1. URI de MongoDB Atlas incorrecta');
      console.log('2. Verificar que la IP esté en la whitelist de Atlas');
      console.log('3. Verificar conectividad a internet');
    } else {
      console.log('1. Verificar que MONGO_URI en .env sea correcta');
      console.log('2. Verificar firewall y puertos (27017 por defecto)');
      console.log('3. Revisar logs de MongoDB para más detalles');
    }
    
    console.log('\n📝 Configuración actual en .env:');
    console.log(`   MONGO_URI=${sanitizedURI}`);
    
    console.log('\n⚠️  El sistema funcionará en MODO MEMORIA (sin persistencia)');
    console.log('   Credenciales: admin@printmaster.local / admin123\n');
    
    process.exit(1);
  });
