# Sistema de Autenticación - Documentación Completa

## 📋 Descripción General

Sistema completo de autenticación y gestión de contraseñas con:
- **Registro de usuarios** con validación y aprobación
- **Login seguro** con bcrypt y sesiones persistentes
- **Recuperación de contraseña** con tokens criptográficos
- **Cambio de contraseña** para usuarios autenticados
- **Servicio de emails** dual: Resend API y SMTP tradicional
- **Validaciones robustas** en todos los endpoints

---

## 🏗️ Cambios Implementados

### Backend

#### 1. **Modelos**
- ✅ `models/User.js`: 
  - Email ahora es requerido y único
  - Password se hashea automáticamente con bcrypt (pre-save hook)
  - Método `comparePassword()` para verificar contraseñas
  - Método estático `authenticate()` para login
  
- ✅ `models/PasswordResetToken.js` (NUEVO):
  - Tokens criptográficos para recuperación de contraseña
  - TTL automático de 1 hora
  - Métodos: `generateToken()`, `createForUser()`, `validateToken()`

#### 2. **Servicios**
- ✅ `services/emailService.js` (NUEVO):
  - Servicio de envío de emails dual: Resend API (recomendado) y SMTP (nodemailer)
  - Detección automática del proveedor mediante `EMAIL_PROVIDER`
  - Plantillas HTML profesionales:
    - `sendWelcomeEmail()`: Email de bienvenida
    - `sendPasswordResetEmail()`: Email con enlace de recuperación
    - `sendPasswordChangedEmail()`: Confirmación de cambio
  - Soporte para Resend API (moderna, sin SMTP)
  - Fallback a SMTP tradicional (Gmail, Outlook, etc.)

#### 3. **Middleware**
- ✅ `middleware/validation.js` (NUEVO):
  - `validateRegistration`: Valida datos de registro (username, email, password)
  - `validateLogin`: Valida credenciales de login
  - `validatePasswordResetRequest`: Valida email para recuperación
  - `validatePasswordReset`: Valida token y nueva contraseña
  - `validatePasswordChange`: Valida cambio de contraseña

#### 4. **Controladores**
- ✅ `controllers/authController.js`:
  - `register()`: Registro con hash de password y email de bienvenida
  - `login()`: Login con bcrypt usando método `authenticate()`
  - `forgotPassword()`: Genera token y envía email de recuperación
  - `verifyResetToken()`: Verifica validez de token antes de mostrar formulario
  - `resetPassword()`: Restablece contraseña con token
  - `changePassword()`: Cambio de contraseña para usuarios autenticados

#### 5. **Rutas**
- ✅ `routes/authRoutes.js`:
  - `POST /api/auth/register` - Registro con validación
  - `POST /api/auth/login` - Login con validación
  - `POST /api/auth/forgot-password` - Solicitar recuperación
  - `GET /api/auth/verify-reset-token/:token` - Verificar token
  - `POST /api/auth/reset-password` - Restablecer contraseña
  - `POST /api/auth/change-password` - Cambiar contraseña (requiere auth)

#### 6. **Configuración**
- ✅ `.env.example`: Plantilla con todas las variables necesarias

---

## ⚙️ Configuración Requerida

### 1. Variables de Entorno

Copia `.env.example` a `.env` y configura:

```bash
# En la carpeta gestorimpresoras-Backend/
cp .env.example .env
```

### **Opción 1: Resend.com (✅ RECOMENDADO)**

Resend es un servicio moderno de emails sin complejidad de SMTP. Ideal para producción.

#### Ventajas:
- ✅ Sin configuración SMTP compleja
- ✅ API REST moderna y simple
- ✅ Dashboard con analytics de emails
- ✅ Mayor deliverability (mejor tasa de entrega)
- ✅ Sin límites de conexión
- ✅ Gratis hasta 3,000 emails/mes

#### Configuración:

1. **Crear cuenta en [Resend.com](https://resend.com/signup)**

2. **Obtener API Key**:
   - Ir a [resend.com/api-keys](https://resend.com/api-keys)
   - Crear nueva API Key
   - Copiar el key (empieza con `re_`)

3. **Configurar `.env`**:

```env
# Configuración Resend
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_TuApiKeyAqui
EMAIL_FROM_NAME=PrintMaster System
EMAIL_FROM_ADDRESS=onboarding@resend.dev
FRONTEND_URL=http://localhost:5173
```

#### Modo Sandbox (Desarrollo):
- ✅ **From address**: `onboarding@resend.dev` (funciona sin verificación)
- ⚠️ **Limitación**: Solo puede enviar emails al correo registrado en tu cuenta
- 🎯 **Perfecto para desarrollo y testing**

#### Modo Producción:
Para enviar emails a cualquier destinatario:

1. **Verificar un dominio propio**:
   - Ir a [resend.com/domains](https://resend.com/domains)
   - Click "Add Domain"
   - Ingresar tu dominio (ej: `tuempresa.com`)
   - Resend te dará registros DNS para configurar:

   ```dns
   SPF:   TXT @ "v=spf1 include:amazonses.com ~all"
   DKIM:  TXT resend._domainkey "v=DKIM1; k=rsa; p=..."
   DMARC: TXT _dmarc "v=DMARC1; p=none; ..."
   ```

2. **Agregar registros en tu proveedor DNS** (GoDaddy, Cloudflare, etc.)

3. **Esperar verificación** (puede tardar hasta 72 horas)

4. **Actualizar `.env`**:
   ```env
   EMAIL_FROM_ADDRESS=noreply@tuempresa.com
   ```

5. **¡Listo!** Ahora puedes enviar a cualquier email

---

### **Opción 2: SMTP Tradicional** (Gmail, Outlook, etc.)

Si prefieres usar SMTP o ya tienes un servidor configurado:

#### Para Gmail:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-contraseña-de-aplicacion
EMAIL_FROM_NAME=PrintMaster System
EMAIL_FROM_ADDRESS=tu-email@gmail.com
FRONTEND_URL=http://localhost:5173
```

**IMPORTANTE**: Para Gmail, debes usar una [Contraseña de Aplicación](https://support.google.com/accounts/answer/185833):
1. Ir a tu cuenta de Google → Seguridad
2. Activar verificación en 2 pasos
3. Ir a "Contraseñas de aplicaciones"
4. Generar nueva contraseña para "Correo"
5. Usar esa contraseña en `SMTP_PASS`

#### Para Outlook:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@outlook.com
SMTP_PASS=tu-contraseña
EMAIL_FROM_NAME=PrintMaster System
EMAIL_FROM_ADDRESS=tu-email@outlook.com
FRONTEND_URL=http://localhost:5173
```

#### Para otros servicios SMTP (SendGrid, Mailgun, Mailjet):

Consulta la documentación específica de cada servicio.

---

---

## 🧪 Testing

### 0. Probar Envío de Emails (Test Script)

Antes de probar el sistema completo, verifica que los emails funcionen:

```bash
node test-email.js
```

**Salida esperada con Resend**:
```
📧 Probando servicio de email...

Configuración actual:
  Proveedor: resend
  From Name: PrintMaster System
  From Email: onboarding@resend.dev
  Resend API Key: ✅ Configurada

📤 Enviando email de prueba...

✅ Email enviado exitosamente!
   ID del mensaje: 02aa111f-1cde-43dc-bc04-c8f8b69f94c3

👉 Revisa tu bandeja de entrada en: tu-email@ejemplo.com
```

**Nota**: En modo sandbox de Resend, solo recibirás el email en tu correo registrado.

---

### 1. Probar Registro de Usuario

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "Test1234",
    "email": "test@example.com",
    "name": "Usuario Test"
  }'
```

**Respuesta esperada**:
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente. Pendiente de aprobación por un administrador.",
  "user": {
    "id": "...",
    "username": "testuser",
    "email": "test@example.com",
    "name": "Usuario Test",
    "role": "PENDING"
  }
}
```

✅ Verifica que llegó el email de bienvenida

### 2. Probar Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "Test1234"
  }'
```

### 3. Probar Recuperación de Contraseña

```bash
# 1. Solicitar recuperación
curl -X POST http://localhost:3001/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'
```

✅ Verifica email con enlace de recuperación

```bash
# 2. Verificar token (obtén el token del email)
curl http://localhost:3001/api/auth/verify-reset-token/TOKEN_AQUI

# 3. Restablecer contraseña
curl -X POST http://localhost:3001/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "TOKEN_AQUI",
    "newPassword": "NuevaPass1234"
  }'
```

✅ Verifica email de confirmación de cambio

### 4. Probar Cambio de Contraseña (autenticado)

```bash
curl -X POST http://localhost:3001/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Cookie: printmaster.sid=SESSION_COOKIE" \
  -d '{
    "currentPassword": "Test1234",
    "newPassword": "NuevaPass5678"
  }'
```

---

## 🔐 Seguridad Implementada

1. **Passwords hasheados**: bcrypt con salt de 10 rondas
2. **Tokens criptográficos**: 32 bytes aleatorios (crypto.randomBytes)
3. **Expiración de tokens**: 1 hora desde creación
4. **Tokens de un solo uso**: Se marcan como usados después del primer uso
5. **Validación de entrada**: Middleware de validación en todas las rutas
6. **Mensajes seguros**: No revela si un email existe en forgot-password
7. **Limpieza automática**: TTL index elimina tokens expirados de MongoDB

---

## 📝 Próximos Pasos (Frontend)

### Componentes necesarios:

1. **RegisterForm.tsx**: Formulario de registro
   ```typescript
   - Campos: username, email, password, confirmPassword, name
   - Validación: password >= 8 chars, emails válidos, passwords coinciden
   - API: POST /api/auth/register
   ```

2. **ForgotPasswordForm.tsx**: Solicitar recuperación
   ```typescript
   - Campo: email
   - API: POST /api/auth/forgot-password
   - Mostrar mensaje: "Si el email existe, recibirás un enlace"
   ```

3. **ResetPasswordForm.tsx**: Formulario de nueva contraseña
   ```typescript
   - Obtener token de URL query params
   - Verificar validez: GET /api/auth/verify-reset-token/:token
   - Campos: newPassword, confirmNewPassword
   - API: POST /api/auth/reset-password
   ```

4. **ChangePasswordForm.tsx**: Cambiar contraseña (en settings)
   ```typescript
   - Campos: currentPassword, newPassword, confirmNewPassword
   - API: POST /api/auth/change-password
   - Requiere autenticación
   ```

### Rutas del frontend:
- `/register` → RegisterForm
- `/forgot-password` → ForgotPasswordForm
- `/reset-password?token=XXX` → ResetPasswordForm
- `/settings` → ChangePasswordForm (en modal existente)

---

## 🐛 Troubleshooting

### Email no se envía:

#### Con Resend:

1. **Error: "You can only send testing emails to your own email address"**
   - ✅ **Normal en modo sandbox**
   - Solo puedes enviar al email de tu cuenta Resend
   - Para enviar a otros: verificar dominio en [resend.com/domains](https://resend.com/domains)

2. **Error: "Invalid API key"**
   - Verificar que `RESEND_API_KEY` esté correcto en `.env`
   - Debe empezar con `re_`
   - Regenerar key en [resend.com/api-keys](https://resend.com/api-keys) si es necesario

3. **Error: "Forbidden: Change the `from` address"**
   - Si ya verificaste un dominio, usar `nombre@tudominio.com`
   - En sandbox, usar `onboarding@resend.dev`

4. **Email no llega**:
   - Verificar carpeta de spam
   - Ver logs en dashboard: [resend.com/emails](https://resend.com/emails)
   - Verificar que el destinatario sea tu email (en sandbox)

#### Con SMTP:

1. **Verificar variables de entorno**: 
   ```bash
   echo $SMTP_HOST
   echo $SMTP_USER
   echo $EMAIL_PROVIDER
   ```

2. **Verificar logs del sistema**:
   - Los errores de email se registran pero no fallan el registro
   - Busca en logs: "Error enviando email"

3. **Gmail bloquea el acceso**:
   - Usar Contraseña de Aplicación (no tu contraseña normal)
   - Verificar que 2FA esté activo
   - Permitir "Aplicaciones menos seguras" (no recomendado)

4. **Firewall/Antivirus**:
   - Verificar que el puerto 587 o 465 esté abierto
   - Desactivar temporalmente firewall para probar

5. **Timeout o Connection Refused**:
   - Verificar conectividad a internet
   - Probar con otro puerto (587 vs 465)
   - Verificar que `SMTP_SECURE` sea correcto (false para 587, true para 465)

### Usuario no puede registrarse:

1. **Email o username duplicado**: Verificar si ya existe
2. **Password muy corto**: Mínimo 8 caracteres
3. **Email inválido**: Debe cumplir formato email@domain.com

### Token inválido al resetear:

1. **Token expirado**: Validez de 1 hora
2. **Token ya usado**: Solo se puede usar una vez
3. **Token no existe**: Copiar correctamente desde email

---

## 📊 Logs del Sistema

Todos los eventos se registran en `addSystemLog()`:

- `AUTH` - Registro: "Nuevo usuario registrado: username"
- `AUTH` - Login exitoso: "Usuario X inició sesión"
- `AUTH` - Login fallido: "Intento de login fallido: credenciales inválidas"
- `AUTH` - Recuperación: "Email de recuperación enviado a X"
- `AUTH` - Reset exitoso: "Contraseña restablecida para X"
- `EMAIL` - Email enviado: "Email de bienvenida enviado a X"
- `EMAIL` - Error: "Error enviando email de bienvenida"

---

## 🎯 Características Implementadas

✅ Registro de usuarios con validación completa  
✅ Contraseñas hasheadas con bcrypt  
✅ Email de bienvenida  
✅ Recuperación de contraseña por email  
✅ Tokens seguros con expiración  
✅ Verificación de token antes de resetear  
✅ Email de confirmación de cambio  
✅ Cambio de contraseña para usuarios autenticados  
✅ Validación de entrada en todos los endpoints  
✅ Logs detallados de eventos de seguridad  
✅ Manejo de errores robusto  
✅ Limpieza automática de tokens expirados  
✅ **Doble proveedor de email: Resend API + SMTP tradicional**  
✅ **Plantillas HTML profesionales y responsive**  
✅ **Script de testing de emails incluido**  
✅ **Fix automático de contraseñas en texto plano**  

---

## 📚 API Reference

### POST /api/auth/register
Registra un nuevo usuario (pendiente de aprobación).

**Body**:
```json
{
  "username": "string (min 3 chars)",
  "password": "string (min 8 chars)",
  "email": "string (valid email, required)",
  "name": "string (optional)"
}
```

**Response 201**:
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente...",
  "user": { "id": "...", "username": "...", "email": "...", "role": "PENDING" }
}
```

---

### POST /api/auth/login
Autentica un usuario.

**Body**:
```json
{
  "username": "string (username or email)",
  "password": "string"
}
```

**Response 200**:
```json
{
  "success": true,
  "message": "Login exitoso",
  "user": { "id": "...", "username": "...", "role": "..." }
}
```

---

### POST /api/auth/forgot-password
Solicita recuperación de contraseña.

**Body**:
```json
{
  "email": "string (valid email)"
}
```

**Response 200**:
```json
{
  "success": true,
  "message": "Si el email está registrado, recibirás un enlace de recuperación"
}
```

---

### GET /api/auth/verify-reset-token/:token
Verifica validez de un token de recuperación.

**Response 200**:
```json
{
  "valid": true,
  "message": "Token válido",
  "expiresAt": "2024-01-15T10:30:00.000Z"
}
```

---

### POST /api/auth/reset-password
Restablece la contraseña con un token válido.

**Body**:
```json
{
  "token": "string",
  "newPassword": "string (min 8 chars)"
}
```

**Response 200**:
```json
{
  "success": true,
  "message": "Contraseña restablecida exitosamente. Ya puedes iniciar sesión."
}
```

---

### POST /api/auth/change-password
Cambia la contraseña del usuario autenticado.

**Headers**: Requiere sesión activa

**Body**:
```json
{
  "currentPassword": "string",
  "newPassword": "string (min 8 chars)"
}
```

**Response 200**:
```json
{
  "success": true,
  "message": "Contraseña cambiada exitosamente"
}
```

---

### POST /api/auth/send-password-recovery
Envía email de recuperación de contraseña a un usuario específico (Admin only).

**Autorización:** 🔐 Requiere rol ADMIN

**Headers**: Requiere sesión activa con rol ADMIN

**Body**:
```json
{
  "userId": "string (MongoDB ObjectId)"
}
```

**Validaciones**:
- Usuario debe existir y estar activo
- No se puede enviar a usuarios con rol PENDING
- Solo administradores pueden ejecutar esta acción

**Response 200**:
```json
{
  "success": true,
  "message": "Email de recuperación enviado a user@example.com"
}
```

**Response 403**:
```json
{
  "error": "Acceso denegado",
  "message": "Esta acción requiere privilegios de administrador"
}
```

**Response 404**:
```json
{
  "error": "Usuario no encontrado"
}
```

**Response 500**:
```json
{
  "error": "Error al enviar el email de recuperación. Verifica la configuración de email."
}
```

**Uso típico**:
- Admin selecciona usuario en panel de gestión
- Sistema genera token de recuperación (válido 1 hora)
- Envía email con enlace personalizado
- Usuario recibe email y puede resetear su contraseña

---

**Response 200**:
```json
{
  "success": true,
  "message": "Contraseña cambiada exitosamente"
}
```
