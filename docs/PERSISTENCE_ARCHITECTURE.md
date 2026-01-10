# Sistema de Persistencia - Arquitectura MVC

## 🏗️ Arquitectura Completa

Este sistema **NO utiliza localStorage**. Toda la persistencia se maneja en el servidor siguiendo el patrón MVC.

## 📦 Modelos (MongoDB)

### 1. **User** (`models/User.js`)
- Información básica del usuario
- Credenciales (hash de contraseña)
- Rol y estado de aprobación

### 2. **UserPreferences** (embebido en User)
- `themeColor`: Color del tema
- `fontFamily`: Familia tipográfica
- `fontSize`: Tamaño de fuente

### 3. **SystemConfig** (`models/SystemConfig.js`)
- Configuración global de la aplicación
- Logo, nombre de empresa, copyright
- Solo editable por administradores

### 4. **Notification** (`models/Notification.js`) ✨ NUEVO
- Notificaciones por usuario
- Estados: leída/no leída
- Limpieza automática: > 30 días

### 5. **UserSession** (`models/UserSession.js`) ✨ NUEVO
- Estado de la UI del usuario
- Impresora seleccionada
- Término de búsqueda
- Preferencias de vista
- Limpieza automática: > 7 días inactividad

### 6. **Printer** (`models/Printer.js`)
- Información de impresoras
- Soft delete (archivado)

### 7. **Log** (`models/Log.js`)
- Registros de mantenimiento

## 🎯 Controladores

### AuthController
- Login/Logout
- Registro de usuarios
- Recuperación de contraseña

### UserController
- Gestión de usuarios
- **Preferencias de usuario** (GET/PUT `/api/users/preferences`)

### SystemConfigController ✨
- **Configuración global** (GET/PUT `/api/system/config`)

### NotificationController ✨ NUEVO
```
GET    /api/notifications           - Obtener notificaciones
POST   /api/notifications           - Crear notificación
PUT    /api/notifications/:id/read  - Marcar como leída
PUT    /api/notifications/read-all  - Marcar todas como leídas
DELETE /api/notifications/:id       - Eliminar notificación
DELETE /api/notifications           - Eliminar todas
GET    /api/notifications/unread-count - Conteo de no leídas
```

### SessionController ✨ NUEVO
```
GET    /api/session  - Obtener estado de sesión
PUT    /api/session  - Actualizar estado de sesión
DELETE /api/session  - Limpiar sesión (logout)
```

## 🚀 Flujo de Datos

### Login
```
1. Usuario inicia sesión → AuthController
2. Sistema carga:
   - Preferencias de usuario (UserController)
   - Configuración del sistema (SystemConfigController)
   - Notificaciones (NotificationController)
   - Estado de sesión anterior (SessionController)
3. Frontend actualiza estado React
```

### Durante la sesión
```
- Cada cambio de preferencia → debounce 1s → PUT /api/users/preferences
- Cada cambio de configuración (admin) → debounce 1s → PUT /api/system/config
- Cada cambio de estado UI → debounce 2s → PUT /api/session
- Nuevas notificaciones → POST /api/notifications
```

### Logout
```
1. DELETE /api/session (limpiar estado UI)
2. POST /api/auth/logout (destruir sesión Express)
3. Frontend limpia estado React
```

## 🧹 Mantenimiento Automático

### Script de limpieza
```bash
npm run cleanup:db
```

**Ejecuta:**
- `Notification.cleanupOldNotifications()` - Elimina notificaciones leídas > 30 días
- `UserSession.cleanupInactiveSessions()` - Elimina sesiones inactivas > 7 días

**Recomendación:** Ejecutar semanalmente con cron job

## 📊 Ventajas vs localStorage

| Aspecto | localStorage | Servidor (MVC) |
|---------|-------------|----------------|
| **Persistencia** | Se pierde al limpiar navegador | Permanente en MongoDB |
| **Multi-dispositivo** | ❌ Solo un dispositivo | ✅ Sincronizado |
| **Seguridad** | ⚠️ Accesible por JavaScript | ✅ Protegido por autenticación |
| **Límite** | ~5-10 MB | Ilimitado |
| **Respaldo** | ❌ No | ✅ Backups de DB |
| **Auditoría** | ❌ No | ✅ Logs completos |

## 🔒 Seguridad

- Todas las rutas protegidas con `authMiddleware`
- Notificaciones separadas por usuario (userId)
- Sesiones separadas por usuario (unique userId)
- Admin-only para configuración del sistema

## 🎨 Patrones Implementados

1. **Repository Pattern**: Modelos Mongoose con métodos estáticos
2. **Controller Pattern**: Lógica de negocio separada de rutas
3. **Middleware Pattern**: Autenticación y autorización
4. **Debounce Pattern**: Evitar llamadas excesivas al servidor (1-2s)
5. **Cleanup Pattern**: Mantenimiento automático de datos

## 📱 Frontend (React)

### Estado Global
```typescript
// Sin localStorage - todo desde servidor
const [currentUser, setCurrentUser] = useState<User | null>(null);
const [settings, setSettings] = useState<AppSettings>(...); // Servidor
const [notifications, setNotifications] = useState<AppNotification[]>([]); // Servidor
const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null); // Servidor
```

### Hooks de Sincronización
```typescript
useEffect(() => {
  if (currentUser) {
    loadData();              // Impresoras, logs
    loadNotifications();     // Notificaciones desde /api/notifications
    loadUserSession();       // Estado UI desde /api/session
  }
}, [currentUser]);

useEffect(() => {
  // Debounce: guardar configuración después de 1s sin cambios
  const timeoutId = setTimeout(savePreferences, 1000);
  return () => clearTimeout(timeoutId);
}, [settings, currentUser]);
```

## 🔄 Migración desde localStorage

Si había datos en localStorage:
1. Los datos antiguos quedarán en el navegador pero no se usarán
2. El sistema cargará todo desde el servidor
3. Opcional: Crear script de migración si se necesita preservar datos antiguos

## 📖 Ejemplos de Uso

### Guardar preferencia de tema
```typescript
setSettings(prev => ({
  ...prev,
  themeColor: newColor
}));
// Automáticamente se guarda en servidor después de 1s
```

### Crear notificación
```typescript
await api.createNotification({
  title: 'Tóner Bajo',
  message: 'La impresora X tiene tóner bajo',
  type: 'alert',
  printerId: printer.id
});
```

### Restaurar sesión
```typescript
const session = await api.getUserSession();
setSelectedPrinterId(session.selectedPrinterId);
setSearchTerm(session.searchTerm);
```

## 🎯 Próximos Pasos

1. Implementar WebSockets para notificaciones en tiempo real
2. Agregar paginación a notificaciones (actualmente límite 100)
3. Implementar filtros avanzados en notificaciones
4. Agregar notificaciones push del navegador
5. Implementar exportación de configuración (backup/restore)
