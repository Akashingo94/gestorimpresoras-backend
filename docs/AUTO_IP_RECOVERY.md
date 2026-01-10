# 🔄 Recuperación Automática de IP por Hostname

## Descripción

El sistema implementa un mecanismo inteligente de recuperación automática de direcciones IP cuando una impresora cambia de dirección (por DHCP u otros motivos). Este sistema utiliza resolución DNS del hostname para encontrar la nueva IP y actualizar automáticamente la configuración.

## ¿Cómo Funciona?

### Flujo de Recuperación

```
1. Usuario hace clic en "SYNC HARDWARE"
   ↓
2. Sistema intenta conectar por SNMP a la IP registrada
   ↓
3. ❌ Fallo de conexión SNMP
   ↓
4. 🔍 Sistema busca el hostname configurado
   ↓
5. 📡 Resuelve hostname a IP usando DNS
   ↓
6. ✅ Nueva IP encontrada
   ↓
7. 🔄 Actualiza IP en base de datos
   ↓
8. 📊 Reintenta sincronización SNMP con nueva IP
   ↓
9. ✅ Sincronización exitosa
   ↓
10. 📬 Notifica al usuario sobre el cambio de IP
```

### Proceso Detallado

#### 1. **Detección de Fallo**
```javascript
try {
  hardwareData = await mockSnmpQuery(session, ip, brand, community);
} catch (snmpError) {
  // Se detecta que la IP original no responde
  console.log(`⚠️ Fallo inicial de SNMP en IP ${ip}`);
  // Activar recuperación automática
}
```

#### 2. **Resolución de Hostname**
```javascript
const hostname = previousPrinter?.hostname || req.body.hostname;
if (hostname && hostname.trim() !== '') {
  const resolvedIP = await resolveHostnameToIP(hostname);
  // resolvedIP contiene la nueva IP
}
```

#### 3. **Actualización Automática**
```javascript
if (resolvedIP && resolvedIP !== ip) {
  // Actualizar sesión SNMP
  session.close();
  session = snmp.createSession(resolvedIP, community, {...});
  
  // Actualizar base de datos
  await Printer.findByIdAndUpdate(id, { 
    $set: { ipAddress: resolvedIP } 
  });
  
  // Reintentar sincronización
  hardwareData = await mockSnmpQuery(session, resolvedIP, brand, community);
}
```

## Configuración

### Requisitos

Para que funcione la recuperación automática, cada impresora debe tener configurado:

1. **Hostname** - Nombre DNS de la impresora
2. **IP Address** - Dirección IP actual (puede quedar desactualizada)

### Configurar Hostname en Impresoras

#### Brother
1. Acceder al panel web de la impresora
2. Ir a **Red** → **TCP/IP** → **Nombre de host**
3. Configurar nombre único (ej: `printer-contabilidad`)
4. Guardar y reiniciar

#### Ricoh
1. Panel web → **Configuración de red**
2. **Nombre de host**: configurar nombre único
3. Aplicar cambios

#### HP/Otros
1. Panel web → **Network Settings**
2. **Hostname**: configurar nombre
3. Guardar configuración

### Configurar DNS

Asegurarse de que el servidor DNS pueda resolver los hostnames:

```bash
# Probar resolución
ping printer-contabilidad
nslookup printer-contabilidad

# Agregar a DNS Windows Server
Add-DnsServerResourceRecordA -Name "printer-contabilidad" -ZoneName "empresa.local" -IPv4Address "192.168.1.100"
```

## Logs del Sistema

El sistema registra cada paso del proceso:

### Log de Fallo Inicial
```
⚠️ [PRINTER_SYNC] Error SNMP en IP 192.168.1.100
   Intentando resolución automática de hostname
```

### Log de Resolución
```
ℹ️ [PRINTER_SYNC] Resolviendo hostname: printer-contabilidad
   IP original: 192.168.1.100
```

### Log de Éxito
```
✅ [PRINTER_SYNC] IP actualizada automáticamente
   Hostname: printer-contabilidad
   IP anterior: 192.168.1.100
   Nueva IP: 192.168.1.150
```

### Log de Error (Hostname no resuelve)
```
❌ [PRINTER_SYNC] Fallo resolución de hostname
   Hostname: printer-contabilidad
   IP original: 192.168.1.100
   No se encontró en DNS
```

## Respuesta del API

Cuando la IP se actualiza automáticamente, la respuesta incluye:

```json
{
  "id": "abc123...",
  "model": "Brother HL-L5200DW",
  "ipAddress": "192.168.1.150",
  "ipUpdated": true,
  "previousIP": "192.168.1.100",
  "message": "✅ IP actualizada automáticamente: 192.168.1.100 → 192.168.1.150",
  "tonerLevels": {...},
  "status": "ONLINE"
}
```

### Campos Adicionales

- **`ipUpdated`** (boolean): `true` si la IP fue actualizada automáticamente
- **`previousIP`** (string): IP anterior antes del cambio
- **`message`** (string): Mensaje descriptivo del cambio

## Interfaz de Usuario

### Notificación Automática

Cuando la IP cambia, el usuario recibe una notificación:

```
✅ IP actualizada automáticamente

La IP de la impresora fue actualizada mediante resolución de hostname.

IP anterior: 192.168.1.100
IP nueva: 192.168.1.150

La impresora ahora responde en la nueva dirección.
```

### Ubicación
- Sistema de notificaciones (esquina superior derecha)
- Tipo: Success (verde)
- Duración: Permanente hasta cerrar

## Casos de Uso

### Caso 1: DHCP Renovó la IP
```
Situación: Impresora reiniciada, DHCP asignó nueva IP
Hostname: printer-rrhh
IP anterior: 192.168.1.100
IP nueva: 192.168.1.150

Resultado: ✅ Sistema detecta y actualiza automáticamente
```

### Caso 2: Cambio de Red
```
Situación: Impresora movida a otra VLAN/subnet
Hostname: printer-gerencia
IP anterior: 192.168.1.100
IP nueva: 192.168.2.50

Resultado: ✅ Sistema detecta y actualiza (si DNS está actualizado)
```

### Caso 3: Hostname No Configurado
```
Situación: Impresora sin hostname
Hostname: (vacío)
IP anterior: 192.168.1.100

Resultado: ❌ Error SNMP sin recuperación
Solución: Configurar hostname en la impresora
```

### Caso 4: Hostname No Resuelve
```
Situación: Hostname configurado pero no en DNS
Hostname: printer-nueva
IP anterior: 192.168.1.100

Resultado: ❌ Error de resolución DNS
Solución: Agregar registro A en el servidor DNS
```

## Debugging

### Verificar Hostname
```bash
# En el servidor donde corre el backend
nslookup printer-nombre
# Debe retornar la IP actual

# Probar conectividad SNMP
snmpwalk -v 2c -c public printer-nombre 1.3.6.1.2.1.1.5
```

### Logs de Backend
```bash
# Observar logs en tiempo real
npm run dev

# Buscar:
🔍 Resolviendo hostname "xxx" a IP...
✅ Hostname resuelto: xxx -> 192.168.1.150
```

### Logs de Sistema (System Logs en interfaz)
```
Filtrar por categoría: PRINTER_SYNC
Buscar logs de tipo: info, success, error
```

## Ventajas

✅ **Cero Intervención Manual**: No requiere editar IPs manualmente  
✅ **Resiliente a Cambios DHCP**: Las impresoras pueden cambiar de IP sin problemas  
✅ **Logs Completos**: Cada cambio queda registrado en System Logs  
✅ **Notificaciones Claras**: El usuario sabe exactamente qué cambió  
✅ **Base de Datos Actualizada**: La IP se actualiza automáticamente en MongoDB  
✅ **Continuidad de Servicio**: La sincronización funciona inmediatamente con la nueva IP  

## Mejores Prácticas

### 1. Configuración de Red
- ✅ Asignar hostnames únicos y descriptivos
- ✅ Registrar hostnames en DNS corporativo
- ✅ Usar convención de nombres (ej: `printer-[ubicacion]-[numero]`)

### 2. Mantenimiento
- ✅ Verificar periódicamente que los hostnames resuelvan correctamente
- ✅ Revisar System Logs para detectar problemas de resolución
- ✅ Mantener DNS actualizado

### 3. Documentación
- ✅ Documentar el hostname de cada impresora
- ✅ Mantener mapa de red actualizado
- ✅ Entrenar usuarios en el uso de hostnames

## Limitaciones

⚠️ **Requiere DNS Configurado**: El hostname debe existir en el servidor DNS  
⚠️ **No Funciona Sin Hostname**: Si no está configurado, falla normalmente  
⚠️ **Depende de Red**: Si hay problemas de red, no puede resolver  
⚠️ **Solo IPv4**: Actualmente solo soporta direcciones IPv4  

## Código Técnico

### Backend: printerController.js
```javascript
// Intentar resolución automática cuando falla SNMP
if (hostname && hostname.trim() !== '') {
  const resolvedIP = await resolveHostnameToIP(hostname);
  if (resolvedIP && resolvedIP !== ip) {
    session.close();
    session = snmp.createSession(resolvedIP, community, {...});
    await Printer.findByIdAndUpdate(id, { $set: { ipAddress: resolvedIP } });
    hardwareData = await mockSnmpQuery(session, resolvedIP, brand, community);
  }
}
```

### Frontend: DetailView.tsx
```typescript
if (didIPChange && liveData.ipUpdated) {
  onAddNotification({
    type: 'success',
    title: 'IP actualizada automáticamente',
    message: `IP anterior: ${liveData.previousIP}\nIP nueva: ${liveData.ipAddress}`
  });
}
```

## Soporte

Para más información o problemas:
- Revisar System Logs en la interfaz
- Verificar logs del backend (consola de Node.js)
- Comprobar resolución DNS con `nslookup`
- Verificar conectividad SNMP con `snmpwalk`

---

**Última actualización**: Enero 2026  
**Versión del sistema**: 1.2.1
