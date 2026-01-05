/**
 * Migration Runner
 * Ejecutor centralizado de migraciones de datos
 * 
 * Registra y ejecuta todas las migraciones necesarias al iniciar la aplicación
 */

const cleanMonochromePrinterData = require('./cleanMonochromePrinters');

/**
 * Array de migraciones a ejecutar en orden
 * Agregar nuevas migraciones aquí según sea necesario
 */
const migrations = [
  {
    name: 'cleanMonochromePrinters',
    fn: cleanMonochromePrinterData,
    description: 'Limpia datos incorrectos de impresoras monocromáticas'
  }
  // Futuras migraciones aquí...
];

/**
 * Ejecuta todas las migraciones registradas
 */
async function runAllMigrations() {
  console.log(`\n📦 Ejecutando ${migrations.length} migración(es)...\n`);
  
  for (const migration of migrations) {
    try {
      await migration.fn();
    } catch (error) {
      console.error(`❌ Error en migración "${migration.name}":`, error.message);
    }
  }
}

module.exports = {
  runAllMigrations,
  migrations
};
