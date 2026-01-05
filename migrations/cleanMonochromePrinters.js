/**
 * Data Migration: Clean Monochrome Printer Data
 * Limpia datos incorrectos de niveles de tóner en impresoras monocromáticas
 * 
 * Problema: Algunas impresoras monocromáticas Brother (HL-L5, DCP-L, MFC-L)
 * tienen registros con niveles de tóner de color que no deberían existir.
 * 
 * Solución: Eliminar los niveles cyan, magenta, yellow y conservar solo black.
 */

const mongoose = require('mongoose');

/**
 * Ejecuta la migración de limpieza de datos de impresoras monocromáticas
 */
async function cleanMonochromePrinterData() {
  try {
    console.log('\n🧹 Ejecutando migración de datos: Limpieza de impresoras monocromáticas...');
    
    const Printer = mongoose.model('Printer');
    const allPrinters = await Printer.find({});
    let cleanedCount = 0;
    
    for (const printer of allPrinters) {
      const isMonochrome = printer.model && (
        printer.model.includes('HL-L5') ||
        printer.model.includes('HL-5') ||
        printer.model.includes('DCP-L') ||
        printer.model.includes('MFC-L') ||
        printer.model.match(/HL-[0-9]/)
      );
      
      if (isMonochrome && printer.tonerLevels) {
        // Verificar si tiene colores que no debería tener
        const hasColors = printer.tonerLevels.cyan !== undefined || 
                          printer.tonerLevels.magenta !== undefined || 
                          printer.tonerLevels.yellow !== undefined;
        
        if (hasColors) {
          const blackLevel = printer.tonerLevels.black || 0;
          await Printer.updateOne(
            { _id: printer._id },
            { $set: { tonerLevels: { black: blackLevel } } }
          );
          console.log(`   ✅ Limpiado: ${printer.model} (${printer.ipAddress}) - Solo negro: ${blackLevel}%`);
          cleanedCount++;
        }
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`✅ Migración completada: ${cleanedCount} impresora(s) monocromática(s) limpiada(s)\n`);
    } else {
      console.log(`✅ Migración completada: No se encontraron impresoras monocromáticas con datos incorrectos\n`);
    }
  } catch (error) {
    console.error(`⚠️ Error en migración de datos: ${error.message}\n`);
  }
}

module.exports = cleanMonochromePrinterData;
