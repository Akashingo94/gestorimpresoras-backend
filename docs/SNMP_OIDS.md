# Documentación de OIDs SNMP

Esta documentación describe los OIDs SNMP utilizados para consultar información de impresoras de diferentes marcas.

## Estándar RFC 3805 (Printer MIB)

### Información General
- **Descripción del Sistema**: `1.3.6.1.2.1.1.1.0` (sysDescr)
- **Nombre del Sistema**: `1.3.6.1.2.1.1.5.0` (sysName)
- **Descripción del Dispositivo**: `1.3.6.1.2.1.25.3.2.1.3.1` (hrDeviceDescr)
- **Nombre de la Impresora**: `1.3.6.1.2.1.43.5.1.1.16.1` (prtGeneralPrinterName)
- **Número de Serie**: `1.3.6.1.2.1.43.5.1.1.17.1` (prtGeneralSerialNumber)

### Niveles de Suministros
- **Nivel Actual**: `1.3.6.1.2.1.43.11.1.1.9.1.{index}` (prtMarkerSuppliesLevel)
- **Capacidad Máxima**: `1.3.6.1.2.1.43.11.1.1.8.1.{index}` (prtMarkerSuppliesMaxCapacity)
- **Tipo de Suministro**: `1.3.6.1.2.1.43.11.1.1.6.1.{index}` (prtMarkerSuppliesType)
- **Nombre del Suministro**: `1.3.6.1.2.1.43.11.1.1.5.1.{index}` (prtMarkerSuppliesDescription)
- **Clase de Suministro**: `1.3.6.1.2.1.43.11.1.1.4.1.{index}` (prtMarkerSuppliesClass)

**Valores especiales de nivel**:
- `-3`: Nivel bajo
- `-2`: Nivel suficiente
- `-1`: Desconocido
- `0-100`: Porcentaje real

**Tipos de Suministro (prtMarkerSuppliesTypeTC)**:
```
1:  other
3:  toner
4:  wasteToner
5:  ink
6:  inkCartridge
7:  inkRibbon
8:  wasteInk
9:  opc
10: developer
11: fuserOil
```

### Estado del Dispositivo
- **Estado del Dispositivo**: `1.3.6.1.2.1.25.3.2.1.5.1` (hrDeviceStatus)
  - `1`: Desconocido
  - `2`: Operativo (running)
  - `3`: Advertencia (warning)
  - `4`: Prueba (testing)
  - `5`: Error (down)

- **Estado de Impresión**: `1.3.6.1.2.1.25.3.5.1.1.1` (hrPrinterStatus)
  - `1`: Otros
  - `2`: Idle (inactivo)
  - `3`: Printing (imprimiendo)
  - `4`: Warmup (calentando)

- **Código de Error**: `1.3.6.1.2.1.43.18.1.1.8.1` (prtAlertDescription)

### Bandejas de Papel
- **Estado de Bandeja**: `1.3.6.1.2.1.43.8.2.1.10.1.{index}` (prtInputCurrentLevel)
- **Capacidad Máxima**: `1.3.6.1.2.1.43.8.2.1.9.1.{index}` (prtInputMaxCapacity)

---

## RICOH M 320F

### OIDs Específicos de Ricoh
**Enterprise OID Base**: `1.3.6.1.4.1.367` (Ricoh)

### Información General
- **Número de Serie**: `1.3.6.1.4.1.367.3.2.1.2.1.4.0` (ricohMachineID)
- **Número de Serie Alt**: `1.3.6.1.4.1.367.3.2.1.2.1.5.0` (ricohSerialNumber)

### Contadores de Páginas
- **Total General**: `1.3.6.1.4.1.367.3.2.1.2.19.1.0.1` (suma de todas las funciones)
- **Contador de Copia**: `1.3.6.1.4.1.367.3.2.1.2.19.1.0.2`
- **Contador de Impresión**: `1.3.6.1.4.1.367.3.2.1.2.19.1.0.3`
- **Contador de Fax**: `1.3.6.1.4.1.367.3.2.1.2.19.1.0.4`

### Niveles de Tóner (Monocromático)
La Ricoh M 320F usa los OIDs estándar RFC 3805 para niveles de tóner.
- **Cálculo**: `(Nivel Actual / Capacidad Máxima) * 100`

### Recomendación
Realizar SNMP Walk a `1.3.6.1.4.1.367` para descubrir OIDs adicionales según firmware.

---

## BROTHER (DCP, HL, MFC)

### OIDs Específicos de Brother
**Enterprise OID Base**: `1.3.6.1.4.1.2435` (Brother)

### Información General
- **Nombre del Modelo**: `1.3.6.1.4.1.2435.2.3.9.4.2.1.5.4.3.0` (brotherModelName)
- **Nombre del Producto**: `1.3.6.1.4.1.2435.2.3.9.4.2.1.5.4.4.0`
- **Nombre del Dispositivo**: `1.3.6.1.4.1.2435.2.4.3.99.1.1.2.1`
- **Modelo Alternativo**: `1.3.6.1.4.1.2435.2.3.9.4.2.1.5.1.5.0`

### Números de Serie Brother
- **Serial Estándar (RFC 3805)**: `1.3.6.1.2.1.43.5.1.1.17.1` (prtGeneralSerialNumber)
- **Serial Brother #1**: `1.3.6.1.4.1.2435.2.3.9.4.2.1.5.1.1.0`
- **Serial Brother #2**: `1.3.6.1.4.1.2435.2.3.9.4.2.1.5.4.1.0`
- **Serial Brother #3**: `1.3.6.1.4.1.2435.2.3.9.4.2.1.5.4.5.0`
- **Serial NC Device**: `1.3.6.1.4.1.2435.2.4.3.99.3.1.6.1.2.1` (servidores de red)

### Niveles de Tóner Brother DCP-L5600DN
**Bug Conocido**: El byte[41] contiene el porcentaje real para el tóner negro (ya corregido).

- **Nivel Tóner Negro**: `1.3.6.1.2.1.43.11.1.1.9.1.1`
- **Capacidad Máxima**: `1.3.6.1.2.1.43.11.1.1.8.1.1`

### Contadores Brother
- **Total de Páginas**: OIDs variables según modelo
- **Páginas en Dúplex**: OIDs variables según modelo

### Servidor de Red NC-8300h (DCP-8155DN y modelos similares)
**Problema**: El NC-8300h es un servidor de impresión de red que oculta el modelo real de la impresora conectada.

**Solución**:
1. Detectar cuando `sysDescr` contiene "NC-8300h" o "NC-" seguido de números
2. Buscar el modelo real en los siguientes OIDs (en orden):
   - `1.3.6.1.4.1.2435.2.3.9.4.2.1.5.4.4.0` (Nombre del producto)
   - `1.3.6.1.4.1.2435.2.3.9.4.2.1.5.4.3.0` (Nombre del modelo)
   - `1.3.6.1.4.1.2435.2.4.3.99.1.1.2.1` (Nombre del dispositivo)
   - `1.3.6.1.2.1.25.3.2.1.3.1` (hrDeviceDescr)
   - `1.3.6.1.2.1.43.5.1.1.16.1` (prtGeneralPrinterName)
3. Si no se encuentra, hacer SNMP Walk en `1.3.6.1.4.1.2435.2.3.9.4.2.1.5.4`
4. Buscar patrón regex: `/(HL|MFC|DCP)-[A-Z0-9]+/i`

**Nota**: Usar múltiples OIDs de serial para asegurar obtener el serial correcto de la impresora, no del servidor NC.

---

## PANTUM

### OIDs Específicos de Pantum
**Enterprise OID Base**: `1.3.6.1.4.1.20540` (Pantum)

### Información General
- **Número de Serie**: `1.3.6.1.4.1.20540.1.2.2.1.3.1` (pantumSerial)
- **Número de Serie Alt**: `1.3.6.1.4.1.20540.1.3.1.1.2.1` (pantumSerialAlt)

### Niveles de Tóner
Pantum tiene una estructura MIB propietaria. Se recomienda:
1. Escanear el árbol completo: `1.3.6.1.4.1.20540`
2. Buscar patrones de versión: `/^[vV]?\d+\.\d+(\.\d+)?$/`
3. Buscar patrones de serial: `/^[A-Z0-9]{10,20}$/`
4. Buscar números 0-100 para niveles de tóner

### Método Alternativo
Pantum también expone información a través de una interfaz web en `http://{ip}/webApi/status/maintenanceInfo`.

---

## HP

### OIDs Específicos de HP
**Enterprise OID Base**: `1.3.6.1.4.1.11` (HP)

HP utiliza principalmente los OIDs estándar RFC 3805 con algunas extensiones propietarias.

### Información General
HP usa OIDs estándar para modelo, serial y firmware.

### Niveles de Suministros
HP implementa completamente RFC 3805 con índices específicos para:
- Tóner Negro: índice 1
- Tóner Cian: índice 2
- Tóner Magenta: índice 3
- Tóner Amarillo: índice 4

---

## Colores de Tóner

### Mapeo por Índice (RFC 3805)
```
Índice 1: Negro (black, bk)
Índice 2: Cian (cyan)
Índice 3: Magenta (magenta)
Índice 4: Amarillo (yellow)
Índice 5: Tambor (drum)
Índice 6: Fusor (fuser)
Índice 7: Tóner de Residuos (waste toner)
```

### Detección de Color por Descripción
El sistema analiza el campo `prtMarkerSuppliesDescription` para detectar:
- `black|negro|bk|k`: Negro
- `cyan|cian`: Cian
- `magenta|mag`: Magenta
- `yellow|amarillo|ye`: Amarillo
- `drum|tambor|imaging|opc`: Tambor
- `fuser|fusor`: Fusor
- `waste|residuo`: Residuos

---

## Estrategia de Consulta SNMP

### 1. Verificación de Conectividad
```
OID: 1.3.6.1.2.1.1.1.0 (sysDescr)
```
Si falla, la impresora no responde a SNMP.

### 2. Información Básica (secuencial)
1. sysDescr
2. sysName
3. hrDeviceDescr
4. prtGeneralPrinterName
5. OIDs específicos de marca

### 3. Número de Serie
Intentar en orden:
1. OID específico de marca
2. prtGeneralSerialNumber (estándar)
3. hrDeviceID

### 4. Niveles de Suministros
1. Escanear árbol: `1.3.6.1.2.1.43.11.1.1`
2. Correlacionar índices entre:
   - Nivel actual (`.9.1.{index}`)
   - Capacidad máxima (`.8.1.{index}`)
   - Tipo (`.6.1.{index}`)
   - Descripción (`.5.1.{index}`)

### 5. Estado del Dispositivo
1. hrDeviceStatus
2. hrPrinterStatus
3. prtAlertDescription (si hay errores)

---

## Comunidades SNMP

### Comunidades Comunes
- `public` (predeterminada, solo lectura)
- `private` (lectura/escritura)
- `admin` (algunas impresoras HP/Brother)

### Configuración
La mayoría de las impresoras requieren habilitar SNMP en el panel web de administración:
- **Brother**: Menú Red → SNMP → Habilitar
- **HP**: Configuración → Red → SNMP → Habilitar
- **Ricoh**: Web Image Monitor → Configuración → SNMP
- **Pantum**: Web UI → Configuración de Red → SNMP

---

## Troubleshooting

### SNMP Timeout
1. Verificar que SNMP esté habilitado en la impresora
2. Verificar comunidad SNMP (probar `public`, `private`, `admin`)
3. Verificar firewall (puerto UDP 161)
4. Verificar conectividad de red (ping)

### Datos Incorrectos
1. Actualizar firmware de la impresora
2. Verificar implementación de RFC 3805
3. Usar OIDs específicos de marca
4. Consultar documentación del fabricante

### Modelo No Detectado
1. Para Brother: buscar en hrDeviceDescr (puede contener modelo real)
2. Para Pantum: escanear árbol enterprise completo
3. Para Ricoh: usar hrDeviceDescr (muy confiable)

---

## Referencias

- **RFC 3805**: Printer MIB v2 (estándar industrial)
- **RFC 1213**: MIB-II (información básica del sistema)
- **net-snmp**: Biblioteca SNMP utilizada
- **Comunidad**: `public` por defecto (solo lectura)

---

**Última actualización**: 2024
**Arquitectura**: Node.js + net-snmp + Express
