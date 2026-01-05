/**
 * Migración: Actualizar índices únicos a índices parciales
 * 
 * Propósito: Permitir reutilizar email/username de usuarios eliminados (soft delete)
 * 
 * Ejecutar: node migrations/update-unique-indexes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/printmaster_db';

async function updateUniqueIndexes() {
    console.log('🔧 Iniciando migración de índices únicos...\n');
    
    try {
        // Conectar a MongoDB
        console.log('📡 Conectando a MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Conectado\n');

        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');

        // 1. Listar índices actuales
        console.log('📋 Índices actuales:');
        const currentIndexes = await usersCollection.indexes();
        currentIndexes.forEach(idx => {
            console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
        });
        console.log('');

        // 2. Eliminar índices únicos antiguos
        console.log('🗑️  Eliminando índices antiguos...');
        
        try {
            // Intentar eliminar índice de username
            if (currentIndexes.find(idx => idx.name === 'username_1')) {
                await usersCollection.dropIndex('username_1');
                console.log('   ✅ Eliminado: username_1');
            } else {
                console.log('   ℹ️  username_1 no existe');
            }
        } catch (e) {
            console.log(`   ⚠️  username_1: ${e.message}`);
        }

        try {
            // Intentar eliminar índice de email
            if (currentIndexes.find(idx => idx.name === 'email_1')) {
                await usersCollection.dropIndex('email_1');
                console.log('   ✅ Eliminado: email_1');
            } else {
                console.log('   ℹ️  email_1 no existe');
            }
        } catch (e) {
            console.log(`   ⚠️  email_1: ${e.message}`);
        }

        console.log('');

        // 3. Crear índices únicos parciales
        console.log('✨ Creando índices únicos parciales...');

        // Índice para username (solo usuarios activos)
        await usersCollection.createIndex(
            { username: 1 },
            {
                unique: true,
                partialFilterExpression: { deletedAt: null },
                name: 'username_unique_active'
            }
        );
        console.log('   ✅ Creado: username_unique_active (solo usuarios activos)');

        // Índice para email (solo usuarios activos)
        await usersCollection.createIndex(
            { email: 1 },
            {
                unique: true,
                partialFilterExpression: { deletedAt: null },
                name: 'email_unique_active'
            }
        );
        console.log('   ✅ Creado: email_unique_active (solo usuarios activos)');

        console.log('');

        // 4. Verificar nuevos índices
        console.log('📋 Índices finales:');
        const finalIndexes = await usersCollection.indexes();
        finalIndexes.forEach(idx => {
            const partial = idx.partialFilterExpression ? ' [PARCIAL]' : '';
            console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}${partial}`);
        });

        console.log('\n✅ Migración completada exitosamente!');
        console.log('\n📝 Resultado:');
        console.log('   - Usuarios activos (deletedAt: null): username/email deben ser únicos');
        console.log('   - Usuarios eliminados (deletedAt: != null): pueden tener username/email duplicados');
        console.log('   - Ahora puedes registrar usuarios con emails de cuentas rechazadas');

        await mongoose.disconnect();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error en migración:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

updateUniqueIndexes();
