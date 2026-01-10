const mongoose = require('mongoose');
const Printer = require('../models/Printer');
require('dotenv').config();

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/printmaster_db');
    
    const total = await Printer.countDocuments({});
    const withDeleted = await Printer.countDocuments({ deleted: { $exists: true } });
    const withoutDeleted = await Printer.countDocuments({ deleted: { $exists: false } });
    const active = await Printer.countDocuments({ $or: [{ deleted: false }, { deleted: { $exists: false } }] });
    
    console.log('=== ESTADO DE IMPRESORAS ===');
    console.log(`Total de impresoras: ${total}`);
    console.log(`Con campo 'deleted': ${withDeleted}`);
    console.log(`Sin campo 'deleted': ${withoutDeleted}`);
    console.log(`Impresoras activas (visible): ${active}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

check();
