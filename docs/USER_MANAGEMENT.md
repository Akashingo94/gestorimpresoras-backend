# Gestión de Usuarios - Sistema Completo

## 🎯 Descripción General

Sistema completo de gestión de usuarios con:
- **Control de acceso basado en roles (RBAC)** - ADMIN, TECHNICIAN, PENDING
- **Flujo de aprobación de solicitudes** - Registro → Revisión → Aprobación/Rechazo
- **Soft delete** - Eliminación lógica con capacidad de restauración
- **Reutilización de emails** - Índices únicos parciales para emails rechazados
- **Auditoría completa** - Logs detallados de todas las operaciones

---

## 🔑 Características Principales

### 1. Sistema de Roles (RBAC)

**Roles disponibles:**
- **ADMIN**: Acceso completo (gestión de usuarios, system logs, configuración)
- **TECHNICIAN**: Acceso operativo (impresoras, mantenimiento, escáner de red)
- **PENDING**: Usuario registrado pendiente de aprobación

### 2. Soft Delete con Índices Únicos Parciales

### Problema Resuelto:
Cuando un usuario es rechazado (soft delete), su email queda "ocupado" en la base de datos, impidiendo que otra persona use ese mismo email para registrarse.

### Solución Implementada (Dos Capas):

#### **Capa 1: Índices Parciales en MongoDB**
Índices únicos que solo validan usuarios activos (`deletedAt: null`):

```javascript
// Índice de username - Solo usuarios activos
UserSchema.index(
    { username: 1 }, 
    { 
        unique: true, 
        partialFilterExpression: { deletedAt: null },
        name: 'username_unique_active'
    }
);

// Índice de email - Solo usuarios activos  
UserSchema.index(
    { email: 1 }, 
    { 
        unique: true, 
        partialFilterExpression: { deletedAt: null },
        name: 'email_unique_active'
    }
);
```

#### **Capa 2: Filtros en Validación de Aplicación**
Los controladores deben filtrar `deletedAt: null` al verificar duplicados:

```javascript
// ✅ CORRECTO - Solo busca usuarios activos
const existingUser = await User.findOne({
  $or: [{ username }, { email }],
  deletedAt: null  // ⚠️ CRÍTICO: Sin este filtro, no funciona la reutilización
});

// ❌ INCORRECTO - Busca todos los usuarios (incluyendo eliminados)
const existingUser = await User.findOne({
  $or: [{ username }, { email }]
});
```

### Resultado:
✅ **Usuarios activos**: username/email únicos garantizados por MongoDB  
✅ **Usuarios eliminados**: pueden tener username/email duplicados  
✅ **Reutilización**: Un email rechazado puede usarse para nuevo registro  
✅ **Sin conflictos**: MongoDB + aplicación validan solo usuarios activos  
⚠️ **Nota importante**: Ambas capas son necesarias para funcionamiento completo

---

## 📋 Cambios Implementados

### 1. **Modelo User actualizado**

#### Nuevos campos:
```javascript
{
  deletedAt: Date | null,        // Timestamp de eliminación (null = activo)
  rejectionReason: String | null // Razón del rechazo/eliminación
}
```

#### Índices únicos parciales:
```javascript
// Solo valida unicidad en usuarios NO eliminados
UserSchema.index(
    { username: 1 }, 
    { 
        unique: true, 
        partialFilterExpression: { deletedAt: null },
        name: 'username_unique_active'
    }
);

UserSchema.index(
    { email: 1 }, 
    { 
        unique: true, 
        partialFilterExpression: { deletedAt: null },
        name: 'email_unique_active'
    }
);
```

#### Migración de índices:
**Script**: `migrations/update-unique-indexes.js`
- Elimina índices únicos globales antiguos (`username_1`, `email_1`)
- Crea índices únicos parciales con `partialFilterExpression`
- Ejecutar: `node migrations/update-unique-indexes.js`

**Resultado esperado:**
```
✅ Migración completada exitosamente!

📋 Índices finales:
   - _id_: {"_id":1}
   - username_unique_active: {"username":1} [PARCIAL]
   - email_unique_active: {"email":1} [PARCIAL]
```

**⚠️ Importante**: Esta migración es necesaria ANTES de que funcione la reutilización de emails.

#### Nuevos métodos de instancia:
- `user.softDelete(reason)` - Marca usuario como eliminado

#### Nuevos métodos estáticos:
- `User.authenticate()` - Ahora excluye usuarios eliminados
- `User.rejectPendingUser(userId, reason)` - Rechaza usuario pendiente
- `User.restore(userId)` - Restaura usuario eliminado

#### Query helpers:
- `.active()` - Filtra solo usuarios activos
- `.deleted()` - Filtra solo usuarios eliminados

---

## 🔌 API Endpoints

### POST /api/auth/register
Registra un nuevo usuario (role PENDING por defecto)

**Body:**
```json
{
  "username": "newuser",
  "email": "new@example.com",
  "password": "SecurePass123"
}
```

**Validaciones:**
- ✅ Username único entre usuarios activos
- ✅ Email único entre usuarios activos
- ✅ Email válido (formato RFC 5322)
- ✅ Password mínimo 8 caracteres
- ✅ **Filtra `deletedAt: null`** para permitir reutilización de emails rechazados

**Implementación crítica:**
```javascript
// authController.js - register()
const existingUser = await User.findOne({
  $or: [{ username }, { email }],
  deletedAt: null  // ⚠️ ESENCIAL para soft delete
});

if (existingUser) {
  return res.status(400).json({ 
    error: existingUser.username === username 
      ? 'El username ya está registrado' 
      : 'El email ya está registrado' 
  });
}
```

**Response 201:**
```json
{
  "message": "Usuario registrado exitosamente",
  "user": {
    "id": "...",
    "username": "newuser",
    "email": "new@example.com",
    "role": "PENDING"
  }
}
```

**Response 400:**
```json
{
  "error": "El email ya está registrado"
}
```

---

### GET /api/users
Lista todos los usuarios (por defecto solo activos)

**Autorización:** 🔐 Requiere rol ADMIN

**Query params:**
- `includeDeleted=true` - Incluir usuarios eliminados

**Response 200:**
```json
[
  {
    "id": "...",
    "username": "john.doe",
    "email": "john@example.com",
    "role": "TECHNICIAN",
    "deletedAt": null,
    "createdAt": "2025-01-01T10:00:00Z"
  }
]
```

**Response 403:**
```json
{
  "error": "Acceso denegado",
  "message": "Esta acción requiere privilegios de administrador"
}
```

---

### GET /api/users/pending
Lista usuarios pendientes de aprobación

**Autorización:** 🔐 Requiere rol ADMIN

**Response 200:**
```json
[
  {
    "id": "...",
    "username": "newuser",
    "email": "new@example.com",
    "role": "PENDING",
    "createdAt": "2025-01-15T14:30:00Z"
  }
]
```

---

### GET /api/users/rejected
Lista usuarios rechazados

**Autorización:** 🔐 Requiere rol ADMIN

**Response 200:**
```json
[
  {
    "id": "...",
    "username": "rejected.user",
    "email": "rejected@example.com",
    "role": "PENDING",
    "deletedAt": "2025-01-15T15:00:00Z",
    "rejectionReason": "Información incompleta en el registro"
  }
]
```

---

### PUT /api/users/:id/role
Actualiza el rol de un usuario y aprueba usuarios pendientes

**Autorización:** 🔐 Requiere rol ADMIN

**Headers:**
- Requiere autenticación como ADMIN

**Body:**
```json
{
  "role": "ADMIN"
}
```

**Roles válidos:**
- `ADMIN` - Administrador con acceso completo
- `TECHNICIAN` - Técnico de campo con acceso limitado
- `PENDING` - Usuario pendiente de aprobación (solo para registro)

**Validaciones:**
- No puede cambiar su propio rol
- Usuario debe existir y estar activo
- Rol debe ser válido

**Funcionalidad especial:**
- Si el usuario tiene rol `PENDING`, esta acción lo **aprueba automáticamente**
- Se registra un log diferenciado: "Usuario aprobado" vs "Rol actualizado"

**Response 200:**
```json
{
  "id": "...",
  "username": "newuser",
  "email": "new@example.com",
  "role": "TECHNICIAN",
  "deletedAt": null
}
```

**Response 403:**
```json
{
  "error": "No puedes cambiar tu propio rol",
  "message": "Por seguridad, no está permitido que un administrador modifique su propio rol"
}
```

**Response 404:**
```json
{
  "error": "Usuario no encontrado o eliminado"
}
```

---

### POST /api/users/:id/reject
Rechaza una solicitud de usuario pendiente (soft delete)

**Autorización:** 🔐 Requiere rol ADMIN

**Headers:**
- Requiere autenticación como ADMIN

**Body:**
```json
{
  "reason": "Información incompleta en el registro"
}
```

**Validaciones:**
- `reason` es requerido
- Mínimo 10 caracteres
- Máximo 500 caracteres
- Usuario debe estar con role PENDING
- Usuario no debe estar ya eliminado

**Response 200:**
```json
{
  "success": true,
  "message": "Solicitud de usuario rechazada",
  "user": {
    "id": "...",
    "username": "rejected.user",
    "email": "rejected@example.com",
    "rejectionReason": "Información incompleta en el registro",
    "rejectedAt": "2025-01-15T15:00:00Z"
  }
}
```

**Response 400:**
```json
{
  "error": "Usuario no encontrado o no está pendiente"
}
```

---

### DELETE /api/users/:id
Elimina un usuario (soft delete)

**Autorización:** 🔐 Requiere rol ADMIN

**Headers:**
- Requiere autenticación como ADMIN

**Body (opcional):**
```json
{
  "reason": "Cuenta inactiva por más de 6 meses"
}
```

**Validaciones:**
- No puede eliminarse a sí mismo
- Usuario debe existir y estar activo

**Response 200:**
```json
{
  "success": true,
  "message": "Usuario eliminado correctamente"
}
```

**Response 403:**
```json
{
  "error": "No puedes eliminar tu propia cuenta",
  "message": "Por seguridad, no está permitido que un administrador elimine su propia cuenta"
}
```

---

### POST /api/users/:id/restore
Restaura un usuario eliminado

**Autorización:** 🔐 Requiere rol ADMIN

**Headers:**
- Requiere autenticación como ADMIN

**Response 200:**
```json
{
  "success": true,
  "message": "Usuario restaurado correctamente",
  "user": {
    "id": "...",
    "username": "restored.user",
    "email": "restored@example.com",
    "role": "TECHNICIAN",
    "deletedAt": null,
    "rejectionReason": null
  }
}
```

**Response 400:**
```json
{
  "error": "Usuario no encontrado o no está eliminado"
}
```

---

### PUT /api/users/:id/role
Actualiza el rol de un usuario

**Validaciones adicionales:**
- No puede cambiar su propio rol
- Solo usuarios activos pueden cambiar de rol

**Response 403:**
```json
{
  "error": "No puedes cambiar tu propio rol",
  "message": "Por seguridad, no está permitido que un administrador modifique su propio rol"
}
```

---

## 🛡️ Seguridad Implementada

### 1. **Control de acceso basado en roles (RBAC)**

#### Roles disponibles:
- **ADMIN**: Acceso completo al sistema
  - ✅ Gestión de usuarios (crear, aprobar, rechazar, eliminar)
  - ✅ Ver y limpiar System Logs
  - ✅ Configuración del sistema
  - ✅ Todas las funcionalidades de TECHNICIAN
  
- **TECHNICIAN**: Acceso limitado a funciones operativas
  - ✅ Ver y gestionar impresoras
  - ✅ Crear logs de mantenimiento
  - ✅ Usar escáner de red
  - ✅ Configuración de apariencia y perfil
  - ❌ NO puede gestionar usuarios
  - ❌ NO puede ver System Logs
  - ❌ NO puede modificar configuración del sistema
  
- **PENDING**: Usuario registrado pendiente de aprobación
  - ❌ Sin acceso al sistema hasta ser aprobado

#### Middleware de autorización:
```javascript
// middleware/userValidation.js
function requireAdmin(req, res, next) {
  if (req.session.userRole !== 'ADMIN') {
    return res.status(403).json({ 
      error: 'Acceso denegado',
      message: 'Esta acción requiere privilegios de administrador'
    });
  }
  next();
}
```

#### Endpoints protegidos:
- 🔐 **GET /api/users** - Solo ADMIN
- 🔐 **GET /api/users/pending** - Solo ADMIN
- 🔐 **GET /api/users/rejected** - Solo ADMIN
- 🔐 **PUT /api/users/:id/role** - Solo ADMIN
- 🔐 **POST /api/users/:id/reject** - Solo ADMIN
- 🔐 **DELETE /api/users/:id** - Solo ADMIN
- 🔐 **POST /api/users/:id/restore** - Solo ADMIN
- 🔐 **POST /api/auth/send-password-recovery** - Solo ADMIN (envío de email de recuperación)
- 🔐 **GET /api/logs/stream** - Solo ADMIN
- 🔐 **GET /api/logs/history** - Solo ADMIN
- 🔐 **POST /api/logs/clear** - Solo ADMIN

### 2. **Protecciones de auto-modificación**
- ❌ Admin no puede eliminarse a sí mismo
- ❌ Admin no puede cambiar su propio rol
- ✅ Se registran intentos bloqueados en logs

### 3. **Validaciones robustas**
- Razón de rechazo obligatoria (10-500 caracteres)
- Rol debe ser válido (ADMIN, TECHNICIAN, PENDING)
- Usuario debe existir y estar en estado correcto

### 4. **Auditabilidad**
- Todos los rechazos se registran con razón
- Logs diferenciados: "Usuario aprobado" vs "Rol actualizado"
- Timestamp de eliminación preserved
- Logs detallados de todas las operaciones

---

## 📊 Ejemplos de Uso

### 1. Aprobar usuario pendiente (asignar rol)

```bash
curl -X PUT http://localhost:3001/api/users/USER_ID/role \
  -H "Content-Type: application/json" \
  -H "Cookie: printmaster.sid=ADMIN_SESSION_COOKIE" \
  -d '{
    "role": "TECHNICIAN"
  }'
```

**Resultado en logs:**
```
✅ [USERS] Usuario aprobado: john.doe
   Rol asignado: TECHNICIAN
```

### 2. Enviar email de recuperación de contraseña (Admin)

```bash
curl -X POST http://localhost:3001/api/auth/send-password-recovery \
  -H "Content-Type: application/json" \
  -H "Cookie: printmaster.sid=ADMIN_SESSION_COOKIE" \
  -d '{
    "userId": "507f1f77bcf86cd799439011"
  }'
```

**Response 200:**
```json
{
  "success": true,
  "message": "Email de recuperación enviado a user@example.com"
}
```

**Resultado en logs:**
```
✅ [AUTH] Admin envió email de recuperación a user@example.com
   Usuario: admin@printmaster.local
```

**Uso desde Frontend:**
- Admin selecciona usuario en panel de gestión
- Click en botón "Enviar mail recuperación" (ícono avión)
- Sistema genera token válido por 1 hora
- Usuario recibe email con enlace personalizado
- Usuario puede resetear su contraseña desde el enlace

### 3. Rechazar usuario pendiente

```bash
curl -X POST http://localhost:3001/api/users/USER_ID/reject \
  -H "Content-Type: application/json" \
  -H "Cookie: printmaster.sid=ADMIN_SESSION_COOKIE" \
  -d '{
    "reason": "El email proporcionado no corresponde al dominio de la empresa"
  }'
```

### 3. Listar solo usuarios pendientes

```bash
curl http://localhost:3001/api/users/pending \
  -H "Cookie: printmaster.sid=ADMIN_SESSION_COOKIE"
```

### 4. Ver usuarios rechazados

```bash
curl http://localhost:3001/api/users/rejected \
  -H "Cookie: printmaster.sid=ADMIN_SESSION_COOKIE"
```

### 4. Restaurar usuario

```bash
curl -X POST http://localhost:5000/api/users/USER_ID/restore \
  -H "Cookie: printmaster.sid=SESSION_COOKIE"
```

### 5. Eliminar usuario activo

```bash
curl -X DELETE http://localhost:5000/api/users/USER_ID \
  -H "Content-Type: application/json" \
  -H "Cookie: printmaster.sid=SESSION_COOKIE" \
  -d '{
    "reason": "Empleado ya no trabaja en la empresa"
  }'
```

### 6. Listar todos los usuarios (incluyendo eliminados)

```bash
curl http://localhost:5000/api/users?includeDeleted=true \
  -H "Cookie: printmaster.sid=SESSION_COOKIE"
```

---

## 🔍 Queries en MongoDB

### Usuarios activos:
```javascript
User.find().active()
// o
User.find({ deletedAt: null })
```

### Usuarios eliminados:
```javascript
User.find().deleted()
// o
User.find({ deletedAt: { $ne: null } })
```

### Usuarios pendientes activos:
```javascript
User.find({ role: 'PENDING', deletedAt: null })
```

### Rechazos con razón específica:
```javascript
User.find({ 
  deletedAt: { $ne: null },
  rejectionReason: { $regex: /email/i }
})
```

### ⚠️ Query común que causa problemas:
```javascript
// ❌ MAL - Incluye usuarios eliminados
const user = await User.findOne({ email: 'test@example.com' });

// ✅ BIEN - Solo usuarios activos
const user = await User.findOne({ 
  email: 'test@example.com',
  deletedAt: null 
});

// ✅ BIEN - Usando query helper
const user = await User.findOne({ email: 'test@example.com' }).active();
```

---

## 🧪 Testing del Sistema

### Caso de Prueba 1: Flujo completo de aprobación
```bash
# 1. Usuario se registra
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"newtech","email":"tech@company.com","password":"Pass1234"}'

# 2. Admin lista pendientes
curl http://localhost:3001/api/users/pending \
  -H "Cookie: printmaster.sid=ADMIN_SESSION"

# 3. Admin aprueba como TECHNICIAN
curl -X PUT http://localhost:3001/api/users/USER_ID/role \
  -H "Content-Type: application/json" \
  -H "Cookie: printmaster.sid=ADMIN_SESSION" \
  -d '{"role":"TECHNICIAN"}'

# 4. Usuario puede hacer login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"newtech","password":"Pass1234"}'

# ✅ Resultado esperado: Login exitoso con rol TECHNICIAN
```

### Caso de Prueba 2: Restricciones por rol
```bash
# 1. Login como TECHNICIAN
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"technician","password":"pass123"}'

# 2. Intentar acceder a gestión de usuarios (debe fallar)
curl http://localhost:3001/api/users \
  -H "Cookie: printmaster.sid=TECH_SESSION"

# ✅ Resultado esperado: 403 Forbidden
# {
#   "error": "Acceso denegado",
#   "message": "Esta acción requiere privilegios de administrador"
# }

# 3. Intentar ver system logs (debe fallar)
curl http://localhost:3001/api/logs/history \
  -H "Cookie: printmaster.sid=TECH_SESSION"

# ✅ Resultado esperado: 403 Forbidden
```

### Caso de Prueba 3: Reutilización de Email
```bash
# 1. Registrar usuario
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test1","email":"test@example.com","password":"Pass1234"}'

# 2. Rechazar usuario (como admin)
curl -X POST http://localhost:3001/api/users/USER_ID/reject \
  -H "Content-Type: application/json" \
  -H "Cookie: printmaster.sid=ADMIN_SESSION" \
  -d '{"reason":"Email de prueba para testing"}'

# 3. Registrar NUEVO usuario con mismo email
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test2","email":"test@example.com","password":"NewPass456"}'

# ✅ Resultado esperado: 201 Created (sin error de duplicado)
```

### Caso de Prueba 2: Unicidad de Activos
```bash
# 1. Registrar usuario
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"john","email":"john@example.com","password":"Pass1234"}'

# 2. Intentar registrar con mismo email (sin rechazar primero)
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"jane","email":"john@example.com","password":"Pass5678"}'

# ✅ Resultado esperado: 400 Bad Request - "El email ya está registrado"
```

---

## 🐛 Solución de Problemas Comunes

### Problema 1: "El email ya está registrado" después de rechazar
**Síntoma:** No se puede reutilizar email de usuario rechazado

**Causas posibles:**
1. ❌ Migración de índices no ejecutada
2. ❌ Controlador no filtra `deletedAt: null`
3. ❌ Índices antiguos no eliminados

**Solución:**
```bash
# 1. Verificar índices en MongoDB
use printmaster
db.users.getIndexes()
# Debe mostrar: username_unique_active y email_unique_active con [PARCIAL]

# 2. Ejecutar migración si es necesario
cd gestorimpresoras-Backend
node migrations/update-unique-indexes.js

# 3. Verificar código de registro
# Buscar en authController.js: debe incluir "deletedAt: null"
```

### Problema 2: Índices parciales no funcionan
**Síntoma:** MongoDB rechaza duplicados incluso con soft delete

**Diagnóstico:**
```javascript
// Verificar en Mongoose
const User = require('./models/User');
console.log(User.schema.indexes());
// Debe mostrar partialFilterExpression: { deletedAt: null }
```

**Solución:**
```bash
# Eliminar colección y recrear (solo en desarrollo)
mongo printmaster --eval "db.users.drop()"
npm run dev  # Mongoose recreará índices correctos
```

### Problema 3: Queries no respetan soft delete
**Síntoma:** Aparecen usuarios eliminados en listados

**Causa:** Falta filtro `deletedAt: null` en queries

**Solución:**
```javascript
// Agregar filtro explícito
const users = await User.find({ deletedAt: null });

// O usar query helper
const users = await User.find().active();
```

---

## 📚 Recursos y Referencias

### Archivos modificados:
- `models/User.js` - Schema + índices parciales
- `controllers/authController.js` - Filtro deletedAt en registro
- `controllers/userController.js` - Reject, restore, delete, aprobación con rol
- `middleware/userValidation.js` - Validaciones + requireAdmin
- `routes/userRoutes.js` - Protección con requireAdmin
- `routes/systemLogRoutes.js` - Protección con requireAdmin
- `migrations/update-unique-indexes.js` - Script de migración
- `components/RejectUserModal.tsx` - UI profesional
- `components/UserManagementModal.tsx` - Selector de rol en aprobación
- `App.tsx` - Restricciones de acceso por rol

### Documentación MongoDB:
- [Partial Indexes](https://docs.mongodb.com/manual/core/index-partial/)
- [Unique Indexes](https://docs.mongodb.com/manual/core/index-unique/)

### Convenciones del proyecto:
- Soft delete: `deletedAt` timestamp (null = activo)
- Razón requerida para rechazo (10-500 chars)
- Admin no puede auto-modificarse
- Logs detallados de todas las operaciones
- Control de acceso basado en roles (RBAC)
- Aprobación con asignación de rol (ADMIN/TECHNICIAN)

---

## 📝 Logs del Sistema

Todos los eventos se registran automáticamente:

### Aprobación de usuario:
```
✅ [USERS] Usuario aprobado: john.doe
   Rol asignado: TECHNICIAN
```

### Cambio de rol:
```
✅ [USERS] Rol actualizado para jane.smith
   TECHNICIAN → ADMIN
```

### Rechazo:
```
⚠️ [USERS] Solicitud rechazada: john.doe
   Razón: Email no corporativo
```

### Eliminación:
```
⚠️ [USERS] Usuario eliminado: jane.smith
   Sin razón especificada
```

### Restauración:
```
✅ [USERS] Usuario restaurado: restored.user
```

### Acceso denegado:
```
⚠️ [AUTH] Acceso denegado a /api/users
   Usuario: technician@company.com
```

### Envío de recuperación por admin:
```
✅ [AUTH] Admin envió email de recuperación a user@example.com
   Usuario: admin@printmaster.local
```

### Intentos bloqueados:
```
⚠️ [USERS] Intento de auto-eliminación bloqueado
   Usuario: admin@company.com
```

---

## ✅ Ventajas del Soft Delete

1. **Auditabilidad completa** - Historial de todas las acciones
2. **Recuperación fácil** - Usuarios pueden ser restaurados
3. **Compliance** - Cumple con regulaciones de retención de datos
4. **Análisis** - Datos disponibles para reports históricos
5. **Debugging** - Facilita investigación de incidentes
6. **Seguridad** - Evita pérdida accidental de información

---

## 🚀 Próximos Pasos

### Backend (Completado ✅):
- [x] Modelo User con soft delete y campos necesarios
- [x] Índices únicos parciales en MongoDB
- [x] Migración de índices legacy a parciales
- [x] API endpoints para reject/restore
- [x] Middleware de validación y seguridad
- [x] Filtros en authController para permitir reutilización
- [x] Logs del sistema para auditoría
- [x] Control de acceso basado en roles (RBAC)
- [x] Middleware requireAdmin para protección de endpoints
- [x] Aprobación de usuarios con asignación de rol

### Frontend (Completado ✅):
- [x] RejectUserModal - Modal profesional con validación
- [x] UserManagementModal - Integración completa
- [x] Gestión visual de usuarios pendientes
- [x] Botones de aprobar/rechazar/restaurar
- [x] Feedback visual con estados y razones
- [x] Selector de rol en aprobación (ADMIN/TECHNICIAN)
- [x] Restricciones de acceso por rol en UI
- [x] Ocultamiento de vistas sensibles para TECHNICIAN
- [x] Tab Sistema protegido en SettingsModal
- [x] Envío de email de recuperación desde admin (botón en lista de usuarios)

### Mejoras Futuras (Opcionales):
- [ ] Tab separado para "Usuarios Rechazados"
- [ ] Búsqueda y filtros en lista de usuarios
- [ ] Export CSV de usuarios rechazados
- [ ] Dashboard con estadísticas de registros/rechazos
- [ ] Notificaciones por email al aprobar usuario
- [ ] Hard delete después de X días (compliance GDPR)
- [ ] Auditoría de cambios de roles
- [ ] Historial de acciones por usuario

---

## 🎯 Matriz de Permisos

| Recurso/Acción | ADMIN | TECHNICIAN | PENDING |
|----------------|-------|------------|---------|
| **Impresoras** |
| Ver listado | ✅ | ✅ | ❌ |
| Agregar/Editar | ✅ | ✅ | ❌ |
| Eliminar | ✅ | ✅ | ❌ |
| Logs de mantenimiento | ✅ | ✅ | ❌ |
| **Red** |
| Escáner de red | ✅ | ✅ | ❌ |
| **Usuarios** |
| Ver usuarios | ✅ | ❌ | ❌ |
| Aprobar solicitudes | ✅ | ❌ | ❌ |
| Rechazar solicitudes | ✅ | ❌ | ❌ |
| Cambiar roles | ✅ | ❌ | ❌ |
| Eliminar usuarios | ✅ | ❌ | ❌ |
| Restaurar usuarios | ✅ | ❌ | ❌ |
| **Sistema** |
| Ver System Logs | ✅ | ❌ | ❌ |
| Limpiar logs | ✅ | ❌ | ❌ |
| Config: Apariencia | ✅ | ✅ | ❌ |
| Config: Sistema | ✅ | ❌ | ❌ |
| Config: Perfil | ✅ | ✅ | ❌ |

---
- [x] Gestión visual de usuarios pendientes
- [x] Botones de aprobar/rechazar/restaurar
- [x] Feedback visual con estados y razones

### Mejoras Futuras (Opcionales):
- [ ] Tab separado para "Usuarios Rechazados"
- [ ] Búsqueda y filtros en lista de usuarios
- [ ] Export CSV de usuarios rechazados
- [ ] Dashboard con estadísticas de registros/rechazos
- [ ] Notificaciones por email al rechazar usuario
- [ ] Hard delete después de X días (compliance GDPR)

---

## 🎨 UI Sugerida

### Lista de pendientes:
```
┌─────────────────────────────────────────────────┐
│ 📋 Usuarios Pendientes (3)                      │
├─────────────────────────────────────────────────┤
│ john.doe@company.com         PENDING            │
│ Registrado: hace 2 horas                        │
│ [✅ Aprobar]  [❌ Rechazar]                      │
├─────────────────────────────────────────────────┤
│ jane.smith@company.com       PENDING            │
│ Registrado: hace 1 día                          │
│ [✅ Aprobar]  [❌ Rechazar]                      │
└─────────────────────────────────────────────────┘
```

### Modal de rechazo:
```
┌─────────────────────────────────────────────────┐
│ ⚠️ Rechazar Solicitud de Usuario                │
├─────────────────────────────────────────────────┤
│ Usuario: john.doe@company.com                   │
│                                                  │
│ Razón del rechazo: *                            │
│ ┌─────────────────────────────────────────────┐ │
│ │ Email no corresponde al dominio corporativo │ │
│ │                                              │ │
│ └─────────────────────────────────────────────┘ │
│ Mínimo 10 caracteres                            │
│                                                  │
│         [Cancelar]    [Rechazar Solicitud]      │
└─────────────────────────────────────────────────┘
```
