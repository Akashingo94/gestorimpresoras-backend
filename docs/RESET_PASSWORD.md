# Reset Password - Documentación Completa

## 📋 Descripción General

Sistema completo de restablecimiento de contraseña implementado con:
- **Verificación de tokens** en backend y frontend
- **UI profesional** con validaciones en tiempo real
- **Flujo automatizado** desde email hasta login
- **Seguridad robusta** con tokens criptográficos

---

## 🏗️ Arquitectura

### Backend (MVC)

#### Modelo: PasswordResetToken
```javascript
// models/PasswordResetToken.js
{
  token: String,        // Hash SHA256 del token
  userId: ObjectId,     // Referencia al usuario
  used: Boolean,        // Marca si ya fue usado
  expiresAt: Date,      // TTL de 1 hora
  createdAt: Date
}

// Métodos estáticos:
- generateToken(): Genera token criptográfico
- createForUser(userId): Crea token para usuario específico
- validateToken(token): Valida token y verifica expiración
```

#### Controlador: authController
```javascript
// controllers/authController.js

verifyResetToken(req, res)
- GET /api/auth/verify-reset-token/:token
- Valida token antes de mostrar formulario
- Response: { valid: true/false, message, expiresAt }

resetPassword(req, res)
- POST /api/auth/reset-password
- Body: { token, newPassword }
- Actualiza contraseña del usuario
- Marca token como usado
- Envía email de confirmación
- Response: { success: true, message }
```

#### Rutas
```javascript
// routes/authRoutes.js
GET  /api/auth/verify-reset-token/:token  // Verificar token
POST /api/auth/reset-password             // Resetear contraseña
```

#### Validación
```javascript
// middleware/validation.js
validatePasswordReset(req, res, next)
- Valida token (requerido, no vacío)
- Valida newPassword (mínimo 4 caracteres)
- Retorna errores 400 si falla
```

---

### Frontend (React + TypeScript)

#### Componente: ResetPassword.tsx
```typescript
interface ResetPasswordProps {
  token: string;              // Token de la URL
  onSuccess: () => void;      // Callback tras éxito
  onBack: () => void;         // Callback para volver
  settings: AppSettings;      // Tema y configuración
}
```

#### Estados del Componente:
```typescript
const [newPassword, setNewPassword] = useState('');
const [confirmPassword, setConfirmPassword] = useState('');
const [showPassword, setShowPassword] = useState(false);
const [loading, setLoading] = useState(false);
const [verifying, setVerifying] = useState(true);
const [tokenValid, setTokenValid] = useState(false);
const [error, setError] = useState('');
const [success, setSuccess] = useState(false);
```

#### Flujo de Ejecución:

```
1. useEffect → Verificar token al montar
   ↓
2. verifyResetToken(token) → GET /verify-reset-token/:token
   ↓
3a. Token válido → setTokenValid(true) → Mostrar formulario
3b. Token inválido → setError() → Mostrar pantalla de error
   ↓
4. Usuario completa formulario
   ↓
5. handleSubmit() → Validaciones
   ↓
6. resetPassword(token, newPassword) → POST /reset-password
   ↓
7. Éxito → setSuccess(true) → Mensaje de confirmación
   ↓
8. setTimeout(3000) → onSuccess() → Redirigir a login
```

#### Pantallas del Componente:

**1. Verificando Token:**
```tsx
<ShieldCheck size={64} className="animate-pulse" />
<p>Verificando token...</p>
```

**2. Token Inválido:**
```tsx
<Warning size={64} className="text-red-400" />
<h2>Token Inválido</h2>
<p>{error}</p>
<button onClick={onBack}>Volver al Login</button>
```

**3. Formulario:**
```tsx
<LockKey size={32} />
<h2>Restablecer Contraseña</h2>
<form onSubmit={handleSubmit}>
  <input type="password" value={newPassword} />
  <input type="password" value={confirmPassword} />
  <button>Restablecer</button>
</form>
```

**4. Éxito:**
```tsx
<CheckCircle size={64} className="text-green-400" />
<h2>¡Contraseña Actualizada!</h2>
<p>Redirigiendo al login...</p>
```

---

### Integración en App.tsx

#### Detección de Token:
```typescript
const [resetToken, setResetToken] = useState<string | null>(null);

useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  if (token) {
    setResetToken(token);
  }
}, []);
```

#### Renderizado Condicional:
```typescript
// Orden de prioridad:
// 1. Verificando sesión → Spinner
// 2. Reset password → ResetPassword
// 3. No autenticado → LoginScreen
// 4. Autenticado → App principal

if (checkingSession) return <Spinner />;

if (resetToken) {
  return <ResetPassword 
    token={resetToken}
    onSuccess={() => {
      setResetToken(null);
      window.history.replaceState({}, '', '/');
    }}
    onBack={() => {
      setResetToken(null);
      window.history.replaceState({}, '', '/');
    }}
    settings={settings}
  />;
}

if (!currentUser) return <LoginScreen />;

return <AppPrincipal />;
```

---

### API Service (snmpService.ts)

```typescript
// Verificar token
export const verifyResetToken = async (token: string): Promise<{
  valid: boolean;
  message?: string;
  error?: string;
}> => {
  return safeFetch(`${API_BASE_URL}/auth/verify-reset-token/${token}`);
};

// Resetear contraseña
export const resetPassword = async (
  token: string, 
  newPassword: string
): Promise<{
  success: boolean;
  message: string;
}> => {
  return safeFetch(`${API_BASE_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword })
  });
};
```

---

## 🔐 Seguridad

### Tokens Criptográficos:
- **Generación**: `crypto.randomBytes(32).toString('hex')` (64 caracteres hex)
- **Almacenamiento**: Hash SHA256 en base de datos
- **Expiración**: 1 hora desde creación (TTL automático)
- **Uso único**: Marcados como `used: true` después del primer uso
- **Imposibles de adivinar**: 2^256 combinaciones posibles

### Validaciones:

#### Backend:
```javascript
// middleware/validation.js
- Token no vacío
- newPassword mínimo 4 caracteres
- Token existe en DB
- Token no expirado
- Token no usado previamente
- Usuario existe y está activo
```

#### Frontend:
```typescript
// ResetPassword.tsx
- newPassword mínimo 4 caracteres
- confirmPassword debe coincidir con newPassword
- Prevención de doble submit (loading state)
```

---

## 🧪 Testing

### Test Manual End-to-End:

#### 1. Admin envía email de recuperación:
```bash
# Login como admin
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"username": "admin", "password": "admin123"}'

# Enviar recuperación a usuario
curl -X POST http://localhost:3001/api/auth/send-password-recovery \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"userId": "675e5a3f0eee5318d0f8e0a2"}'

# Response:
{
  "success": true,
  "message": "Email de recuperación enviado a user@example.com"
}
```

#### 2. Usuario recibe email:
```
De: PrintMaster System <onboarding@resend.dev>
Para: user@example.com
Asunto: Recuperación de Contraseña - GestorImpresoras

Link: http://localhost:5173/reset-password?token=c04d05fe27f9902d16f3d5a76b90035063c7466eb720fb55314c8d1b4c06e29d
```

#### 3. Verificar token (automático al abrir link):
```bash
curl http://localhost:3001/api/auth/verify-reset-token/c04d05fe27f9902d16f3d5a76b90035063c7466eb720fb55314c8d1b4c06e29d

# Response:
{
  "valid": true,
  "message": "Token válido",
  "expiresAt": "2025-12-30T15:30:00.000Z"
}
```

#### 4. Resetear contraseña:
```bash
curl -X POST http://localhost:3001/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "c04d05fe27f9902d16f3d5a76b90035063c7466eb720fb55314c8d1b4c06e29d",
    "newPassword": "nuevacontraseña123"
  }'

# Response:
{
  "success": true,
  "message": "Contraseña restablecida exitosamente. Ya puedes iniciar sesión."
}
```

#### 5. Login con nueva contraseña:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "password": "nuevacontraseña123"}'

# Response:
{
  "id": "675e5a3f0eee5318d0f8e0a2",
  "username": "user",
  "email": "user@example.com",
  "role": "TECHNICIAN"
}
```

---

### Test de Casos Edge:

#### Token Expirado:
```bash
# Esperar 1 hora o modificar expiresAt en DB
curl http://localhost:3001/api/auth/verify-reset-token/TOKEN_EXPIRADO

# Response:
{
  "error": "Token inválido, expirado o ya utilizado",
  "valid": false
}
```

#### Token Ya Usado:
```bash
# Intentar usar el mismo token dos veces
curl -X POST http://localhost:3001/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token": "TOKEN_USADO", "newPassword": "pass123"}'

# Response:
{
  "error": "Token inválido, expirado o ya utilizado"
}
```

#### Contraseña Muy Corta:
```bash
curl -X POST http://localhost:3001/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token": "TOKEN_VALIDO", "newPassword": "123"}'

# Response:
{
  "error": "Errores de validación",
  "errors": ["La contraseña debe tener al menos 4 caracteres"]
}
```

---

## 📝 Logs del Sistema

### Logs Generados:

#### Token Generado:
```
✅ [AUTH] Token de reset generado para usuario user@example.com - Expira: 2025-12-30 15:30:00
```

#### Email Enviado:
```
📧 [EMAIL] Enviando email de reset a user@example.com
✅ [EMAIL] Email enviado via Resend con ID: abc-123-def-456
```

#### Token Verificado:
```
✅ [AUTH] Token de reset verificado correctamente
```

#### Contraseña Restablecida:
```
✅ [AUTH] Contraseña restablecida para user
```

#### Email de Confirmación:
```
📧 [EMAIL] Enviando confirmación de cambio de contraseña
✅ [EMAIL] Email enviado via Resend con ID: xyz-789-uvw-012
```

#### Errores:
```
⚠️ [AUTH] Intento de reset con token inválido
❌ [AUTH] Error restableciendo contraseña: Usuario no encontrado
⚠️ [EMAIL] Error enviando confirmación de cambio: SMTP error
```

---

## 🎨 UI/UX

### Diseño:
- 🌈 **Tema dinámico** heredado de AppSettings
- 🎨 **Gradientes** personalizados según color principal
- 💫 **Animaciones** suaves con Framer Motion
- 📱 **Responsive** para móviles y tablets
- ♿ **Accesibilidad** con labels y ARIA

### Estados Visuales:
- ⏳ **Verificando**: Spinner animado con ShieldCheck
- ❌ **Error**: Warning icon rojo con mensaje descriptivo
- ✏️ **Formulario**: Inputs estilizados con iconos Phosphor
- 👁️ **Toggle password**: Botón Eye/EyeSlash
- ⏱️ **Loading**: Spinner en botón de submit
- ✅ **Éxito**: CheckCircle verde con mensaje y countdown

### Feedback al Usuario:
```typescript
// Validación en tiempo real
if (newPassword.length < 4) {
  <p className="text-red-200">Mínimo 4 caracteres</p>
}

// Error de contraseñas no coinciden
if (newPassword !== confirmPassword) {
  <p className="text-red-200">Las contraseñas no coinciden</p>
}

// Éxito con redirección
<CheckCircle />
<h2>¡Contraseña Actualizada!</h2>
<p>Redirigiendo al login...</p>
setTimeout(() => onSuccess(), 3000)
```

---

## 🐛 Troubleshooting

### Frontend:

#### Problema: Token no detectado en URL
```typescript
// Verificar que el useEffect esté ejecutándose
console.log('URL params:', window.location.search);
console.log('Token:', new URLSearchParams(window.location.search).get('token'));
```

#### Problema: Componente no renderiza
```typescript
// Verificar orden de renderizado en App.tsx
// ResetPassword debe estar ANTES de LoginScreen
if (resetToken) return <ResetPassword />  // ✅ Correcto
if (!currentUser) return <LoginScreen />  // Después
```

#### Problema: Token se limpia prematuramente
```typescript
// No limpiar token hasta completar flujo
// Limpiar solo en onSuccess o onBack
```

### Backend:

#### Problema: Token inválido siempre
```bash
# Verificar que el token en DB no esté hasheado incorrectamente
# El token en URL debe coincidir con el hasheado en DB
node
> const crypto = require('crypto');
> const hash = crypto.createHash('sha256').update('TOKEN_DE_URL').digest('hex');
> console.log(hash);
```

#### Problema: Token expira inmediatamente
```javascript
// Verificar TTL en modelo
// models/PasswordResetToken.js
expiresAt: {
  type: Date,
  default: () => Date.now() + 3600000, // 1 hora = 3600000 ms
  expires: 3600  // TTL index en segundos
}
```

---

## ✅ Checklist de Implementación

### Backend
- [x] Modelo PasswordResetToken con TTL
- [x] Método generateToken() con crypto
- [x] Método validateToken() con verificaciones
- [x] Endpoint GET /verify-reset-token/:token
- [x] Endpoint POST /reset-password
- [x] Middleware validatePasswordReset
- [x] Email de confirmación sendPasswordChangedEmail
- [x] System logs en todas las operaciones

### Frontend
- [x] Componente ResetPassword.tsx
- [x] useEffect para verificar token
- [x] Estados: verifying, tokenValid, loading, success
- [x] Pantalla de verificación con spinner
- [x] Pantalla de error con token inválido
- [x] Formulario con validaciones
- [x] Toggle mostrar/ocultar contraseña
- [x] Pantalla de éxito con redirección
- [x] Integración en App.tsx
- [x] Detección de token en URL
- [x] Limpieza de URL tras completar

### API Service
- [x] Función verifyResetToken
- [x] Función resetPassword
- [x] Tipado TypeScript correcto

### Seguridad
- [x] Tokens criptográficos de 32 bytes
- [x] Hash SHA256 en DB
- [x] Expiración de 1 hora
- [x] Tokens de un solo uso
- [x] Validación de contraseña mínimo 4 caracteres
- [x] Limpieza automática con TTL

### UX
- [x] Feedback visual en todos los estados
- [x] Mensajes de error claros
- [x] Loading states en botones
- [x] Redirección automática
- [x] Diseño responsive
- [x] Tema dinámico integrado

---

## 🚀 Próximas Mejoras Opcionales

### Funcionalidades:
- [ ] Rate limiting para prevenir abuse
- [ ] Botón "Reenviar email" si token expiró
- [ ] Mostrar tiempo restante del token
- [ ] Historial de resets en perfil de usuario
- [ ] Notificación de reset a email secundario

### UI/UX:
- [ ] Progress bar del tiempo restante del token
- [ ] Strength meter de contraseña
- [ ] Sugerencias de contraseña segura
- [ ] Dark mode específico para reset
- [ ] Animaciones más elaboradas con Framer Motion

### DevEx:
- [ ] Tests unitarios con Jest
- [ ] Tests E2E con Playwright
- [ ] Storybook para componente ResetPassword
- [ ] Métricas de uso de reset password

---

## 📞 Soporte

Si encuentras problemas:

1. **Verificar logs del backend** con `node server.js`
2. **Verificar console del browser** con DevTools
3. **Revisar email en spam** o logs de Resend
4. **Verificar variables de entorno** en `.env`
5. **Consultar logs del sistema** con System Logs UI

---

**Última actualización**: Diciembre 2025  
**Autor**: Sistema GestorImpresoras  
**Versión**: 2.0
