#!/usr/bin/env node

/**
 * Script de limpieza de puertos
 * Mata todos los procesos Node.js que estén ocupando los puertos del proyecto
 * 
 * Uso: node scripts/cleanup-ports.js
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const PORTS = [3000, 4000, 5000]; // Puertos a limpiar

console.log('🧹 Iniciando limpieza de puertos...\n');

async function killProcessOnPort(port) {
  try {
    // Buscar procesos en el puerto (Windows)
    const { stdout } = await execPromise(
      `powershell -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"`
    );

    const pid = stdout.trim();
    
    if (pid && pid !== '') {
      console.log(`📍 Puerto ${port} ocupado por PID ${pid}`);
      
      // Matar el proceso
      await execPromise(`taskkill /PID ${pid} /F`);
      console.log(`✅ Proceso ${pid} terminado (puerto ${port})\n`);
      return true;
    } else {
      console.log(`✅ Puerto ${port} está libre\n`);
      return false;
    }
  } catch (error) {
    // Puerto libre o error al buscar
    console.log(`✅ Puerto ${port} está libre\n`);
    return false;
  }
}

async function cleanupAllPorts() {
  let cleaned = false;
  
  for (const port of PORTS) {
    const wasOccupied = await killProcessOnPort(port);
    if (wasOccupied) cleaned = true;
  }
  
  if (cleaned) {
    console.log('✨ Limpieza completada. Puertos liberados.');
  } else {
    console.log('✨ No había puertos ocupados.');
  }
  
  console.log('\n💡 Ahora puedes ejecutar: npm run dev\n');
}

// Ejecutar limpieza
cleanupAllPorts().catch((error) => {
  console.error('❌ Error durante la limpieza:', error.message);
  process.exit(1);
});
