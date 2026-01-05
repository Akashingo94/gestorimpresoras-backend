# 🔧 Configuración Alternativa: Gmail SMTP

Si Resend API no funciona debido a problemas de red/firewall, puedes usar Gmail SMTP como alternativa.

## 📋 Pasos Rápidos

### 1. Generar Contraseña de Aplicación en Gmail

1. Ve a tu cuenta de Google: https://myaccount.google.com/
2. Click en **Seguridad** (menú izquierdo)
3. Activa **Verificación en 2 pasos** si no está activa
4. Busca **Contraseñas de aplicaciones**
5. Selecciona **Correo** y **Windows Computer** (o el dispositivo)
6. Click **Generar**
7. Copia la contraseña de 16 caracteres que aparece

### 2. Actualizar .env

Edita el archivo `.env` en la carpeta `gestorimpresoras-Backend`:

```env
# Cambiar de Resend a SMTP
EMAIL_PROVIDER=smtp

# Configuración Gmail SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=benitezmiguel747@gmail.com
SMTP_PASS=tu-contraseña-de-aplicacion-de-16-caracteres

# Información del remitente
EMAIL_FROM_NAME=GestorImpresoras System
EMAIL_FROM_ADDRESS=benitezmiguel747@gmail.com

# URL del frontend (no cambiar)
FRONTEND_URL=http://localhost:5173
```

**⚠️ IMPORTANTE:** 
- Usa la contraseña de aplicación de 16 caracteres, NO tu contraseña normal de Gmail
- No compartas el archivo .env con nadie

### 3. Reiniciar el Servidor

```bash
# Detener el servidor (Ctrl+C)
# Iniciar nuevamente
node server.js
```

### 4. Probar

Desde la UI de admin, envía un email de recuperación de contraseña.

**Logs esperados:**
```
📧 [EMAIL] Enviando email via SMTP...
✅ [EMAIL] Email enviado a benitezmiguel747@gmail.com via SMTP
```

---

## 🐛 Troubleshooting Gmail

### Error: "Invalid login"
- Verifica que 2FA esté activo
- Usa contraseña de aplicación, no tu contraseña normal
- Regenera la contraseña de aplicación

### Error: "Connection timeout"
- Verifica firewall/antivirus
- Prueba cambiar puerto 587 por 465 (y SMTP_SECURE=true)

### Email no llega
- Revisa carpeta de Spam
- Verifica que SMTP_USER y EMAIL_FROM_ADDRESS sean el mismo email

---

## 🔄 Volver a Resend

Si quieres volver a intentar con Resend después:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_U4CaEsSQ_9KoATe9phd34E6nbgnSrD9Uy
EMAIL_FROM_NAME=GestorImpresoras System
EMAIL_FROM_ADDRESS=onboarding@resend.dev
FRONTEND_URL=http://localhost:5173
```

Y ejecuta el diagnóstico:
```bash
node test-resend-connection.js
```
