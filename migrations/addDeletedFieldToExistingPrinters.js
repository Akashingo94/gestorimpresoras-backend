/**
 * Migración: Agregar campo 'deleted' a impresoras existentes
 * 
 * PROBLEMA: Al agregar el campo 'deleted' al modelo, las impresoras
 * existentes no tienen este campo, causando que no aparezcan en las consultas.
 * 
 * SOLUCIÓN: Agregar deleted: false a todas las impresoras existentes
 */

const mongoose = require('mongoose');
const Printer = require('../models/Printer');

// Cargar variables de entorno
require('dotenv').config();

async function migrate() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/printmaster_db');
    
    console.log('✅ Conectado a MongoDB');
    console.log('');
    
    // Buscar todas las impresoras que no tienen el campo 'deleted'
    const printersWithoutDeleted = await Printer.find({ 
      deleted: { $exists: false } 
    }).countDocuments();
    
    console.log(`📊 Impresoras sin campo 'deleted': ${printersWithoutDeleted}`);
    
    if (printersWithoutDeleted === 0) {
      console.log('✅ Todas las impresoras ya tienen el campo deleted');
      process.exit(0);
    }
    
    console.log('🔧 Actualizando impresoras...');
    
    // Actualizar todas las impresoras sin el campo 'deleted'
    const result = await Printer.updateMany(
      { deleted: { $exists: false } },
      { 
        $set: { 
          deleted: false,
          deletedAt: null,
          deletedBy: null,
          deletionReason: null
        } 
      }
    );
    
    console.log('');
    console.log('✅ Migración completada exitosamente');
    console.log(`   Impresoras actualizadas: ${result.modifiedCount}`);
    console.log('');
    
    // Verificar que ahora todas las impresoras sean visibles
    const visiblePrinters = await Printer.find({ deleted: false }).countDocuments();
    console.log(`📊 Impresoras visibles ahora: ${visiblePrinters}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  }
}

// Ejecutar migración
migrate();
