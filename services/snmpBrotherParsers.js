/**
 * Servicio SNMP - Parsers Brother
 * Decodificadores específicos para OIDs propietarios de Brother
 */

/**
 * Decodifica el OID especial de Brother brInfoMaintenance
 * OID: .1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.8.0
 * 
 * Este OID contiene información de mantenimiento en un buffer OctetString:
 * - Porcentaje de vida restante de tóner
 * - Porcentaje de vida restante de tambor (drum)
 * - Porcentaje de vida restante de unidad de fusión (fuser)
 * - Porcentaje de vida restante de kit de alimentación de papel
 * 
 * @param {Buffer} buffer - Buffer retornado por el OID brInfoMaintenance
 * @returns {Object} - Objeto con niveles de toner, drum, fuser, paperKit
 */
function parseBrotherMaintenanceInfo(buffer) {
  const info = {
    toner: null,
    drum: null,
    fuser: null,
    paperKit: null
  };
  
  if (!Buffer.isBuffer(buffer)) {
    console.log('   ⚠️ parseBrotherMaintenanceInfo: No es un Buffer');
    return info;
  }
  
  console.log(`   📊 Decodificando brInfoMaintenance (${buffer.length} bytes):`);
  console.log(`      Buffer hex: ${buffer.toString('hex')}`);
  
  // Mostrar todos los bytes para diagnóstico
  for (let i = 0; i < Math.min(buffer.length, 20); i++) {
    console.log(`      byte[${i}]: ${buffer[i]} (0x${buffer[i].toString(16).padStart(2, '0')})`);
  }
  
  // Brother DCP-L5600DN / HL-L5xxx - Posiciones específicas en el buffer
  // Basado en análisis empírico del OID .1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.8.0
  // 
  // IMPORTANTE: Los valores en este OID están en PORCENTAJE RESTANTE (no consumido)
  // Es decir, si el byte[41] = 30, significa 30% restante de tóner
  
  // Posiciones conocidas para DCP-L5600DN (buffer de 106 bytes):
  // byte[41]: Nivel de TÓNER (% restante directo)
  // byte[1]: Nivel de TAMBOR (% restante directo o invertido)
  // byte[2]: Nivel de FUSER (% restante directo o invertido)
  
  console.log(`   🔍 Extrayendo valores de posiciones específicas Brother DCP-L5600DN:`);
  
  // TÓNER: byte[41] contiene el porcentaje RESTANTE directo
  if (buffer.length > 41) {
    const tonerValue = buffer[41];
    if (tonerValue >= 0 && tonerValue <= 100) {
      info.toner = tonerValue; // Ya es el valor restante
      console.log(`   🎯 Tóner (byte[41]): ${tonerValue}% RESTANTE (valor directo)`);
    }
  }
  
  // TAMBOR (DRUM): byte[1] - puede estar invertido (consumido)
  if (buffer.length > 1) {
    const drumValue = buffer[1];
    if (drumValue >= 0 && drumValue <= 100) {
      // Si el valor es muy bajo (1-10), probablemente es restante directo
      // Si es alto (90-99), probablemente es consumido
      if (drumValue <= 10) {
        info.drum = drumValue; // Ya es restante
        console.log(`   🎯 Tambor (byte[1]): ${drumValue}% RESTANTE (valor directo)`);
      } else {
        info.drum = 100 - drumValue; // Invertir: es consumido
        console.log(`   🎯 Tambor (byte[1]): ${drumValue}% consumido → ${info.drum}% restante`);
      }
    }
  }
  
  // FUSER: byte[2] - puede estar invertido (consumido)
  if (buffer.length > 2) {
    const fuserValue = buffer[2];
    if (fuserValue >= 0 && fuserValue <= 100) {
      // Aplicar misma lógica que drum
      if (fuserValue <= 10) {
        info.fuser = fuserValue;
        console.log(`   🎯 Fuser (byte[2]): ${fuserValue}% RESTANTE (valor directo)`);
      } else {
        info.fuser = 100 - fuserValue;
        console.log(`   🎯 Fuser (byte[2]): ${fuserValue}% consumido → ${info.fuser}% restante`);
      }
    }
  }
  
  // PAPER KIT: Puede estar en byte[48] o byte[3]
  if (buffer.length > 48) {
    const paperKitValue = buffer[48];
    if (paperKitValue >= 0 && paperKitValue <= 100) {
      if (paperKitValue <= 10) {
        info.paperKit = paperKitValue;
        console.log(`   🎯 Paper Kit (byte[48]): ${paperKitValue}% RESTANTE (valor directo)`);
      } else {
        info.paperKit = 100 - paperKitValue;
        console.log(`   🎯 Paper Kit (byte[48]): ${paperKitValue}% consumido → ${info.paperKit}% restante`);
      }
    }
  }
  
  // Si no encontramos valores, intentar estrategia de fallback
  if (info.toner === null) {
    console.log(`   ⚠️ No se encontró tóner en byte[41], buscando en otras posiciones...`);
    
    // Buscar todos los bytes válidos como fallback
    const validBytes = [];
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] >= 0 && buffer[i] <= 100) {
        validBytes.push({ index: i, value: buffer[i] });
      }
    }
    
    console.log(`   🔍 Bytes válidos (0-100) encontrados: ${validBytes.length}`);
    validBytes.slice(0, 10).forEach(b => {
      console.log(`      byte[${b.index}]: ${b.value}%`);
    });
  }
  
  return info;
}

/**
 * Decodifica el OID especial de Brother brInfoCounter
 * OID: .1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.10.0
 * 
 * Contiene contadores detallados (copias, impresiones, escaneos)
 * Nota: Este OID puede requerir decodificación compleja de múltiples contadores
 * 
 * @param {Buffer} buffer - Buffer retornado por el OID brInfoCounter
 * @returns {Object} - Objeto con contadores
 */
function parseBrotherCounterInfo(buffer) {
  const info = {
    totalPages: null,
    copies: null,
    prints: null,
    tonerLevel: null
  };
  
  if (!Buffer.isBuffer(buffer)) {
    console.log('   ⚠️ parseBrotherCounterInfo: No es un Buffer');
    return info;
  }
  
  console.log(`   📊 Decodificando brInfoCounter (${buffer.length} bytes):`);
  console.log(`      Buffer hex: ${buffer.toString('hex')}`);
  
  // Brother suele usar múltiples bytes para contadores grandes
  // Intentar leer como enteros de 32 bits (big-endian)
  if (buffer.length >= 4) {
    try {
      // Contador total suele estar en los primeros 4 bytes
      info.totalPages = buffer.readUInt32BE(0);
      console.log(`   📄 Total páginas: ${info.totalPages}`);
    } catch (e) {
      console.log(`   ⚠️ Error leyendo contador: ${e.message}`);
    }
  }
  
  // El byte 13 contiene información de tóner (backward compatibility)
  if (buffer.length >= 14) {
    const tonerConsumed = buffer[13];
    info.tonerLevel = 100 - tonerConsumed;
    console.log(`   🖨️ Nivel tóner (byte[13]): ${info.tonerLevel}%`);
  }
  
  return info;
}

/**
 * Decodifica buffer Brother que contiene nivel de tóner
 * Usado para OIDs como tonerBlack, tonerCyan, etc.
 * @param {Buffer} buffer - Buffer con datos de tóner
 * @returns {number|null} Nivel de tóner en porcentaje
 */
function parseBrotherTonerBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    return null;
  }
  
  console.log(`      Buffer length: ${buffer.length} bytes`);
  console.log(`      Buffer hex: ${buffer.toString('hex')}`);
  
  // Brother HL-L5100DN / DCP-L5650DN devuelven un Octet String estructurado
  // El byte 13 (índice 13, posición 14) contiene el PORCENTAJE CONSUMIDO (no restante)
  // Por lo tanto: Tóner restante = 100 - byte[13]
  
  if (buffer.length >= 14) {
    const tonerConsumed = buffer[13];
    
    if (tonerConsumed >= 0 && tonerConsumed <= 100) {
      const tonerRemaining = 100 - tonerConsumed;
      console.log(`         → byte[13] = ${tonerConsumed}% consumido`);
      console.log(`         → Nivel restante = ${tonerRemaining}%`);
      return tonerRemaining;
    } else {
      console.log(`         → byte[13] = ${tonerConsumed} (fuera de rango 0-100)`);
    }
  }
  
  // Fallback: intentar interpretarlo como un valor directo
  if (buffer.length === 1) {
    const directValue = buffer[0];
    if (directValue >= 0 && directValue <= 100) {
      console.log(`         → Valor directo de 1 byte: ${directValue}%`);
      return directValue;
    }
  }
  
  return null;
}

module.exports = {
  parseBrotherMaintenanceInfo,
  parseBrotherCounterInfo,
  parseBrotherTonerBuffer
};
