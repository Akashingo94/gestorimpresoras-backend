# 📧 Configuración de Emails

## Problema: Error 403 al Enviar Emails con Resend

### Síntoma
```
Error al enviar el email de recuperación. Inténtalo más tarde.

Console:
❌ [EMAIL] Error Resend (403) - You can only send testing emails to your own 
email address (benitezmiguel747@gmail.com). To send emails to other recipients, 
please verify a domain at resend.com/domains
```

### Causa
Resend en **modo sandbox** (desarrollo) solo permite enviar emails a la dirección registrada en tu cuenta de Resend. Este es un comportamiento de seguridad para evitar envío masivo de emails durante testing.

---

## 🔧 Soluciones

### Opción 1: Verificar un Dominio en Resend (Recomendado para Producción)

Esta es la solución profesional para entornos de producción.

#### Pasos:

1. **Registra un dominio**
   - Si no tienes uno, puedes usar servicios como Namecheap, GoDaddy, etc.
   - Costo aproximado: $10-15 USD/año

2. **Verifica el dominio en Resend**
   ```
   1. Ve a: https://resend.com/domains
   2. Click en "Add Domain"
   3. Ingresa tu dominio (ej: miempresa.com)
   4. Resend te dará registros DNS para configurar
   ```

3. **Configura DNS en tu proveedor**
   
   Agrega estos registros en tu proveedor de dominio:
   
   ```dns
   # SPF Record (TXT)
   Tipo: TXT
   Nombre: @
   Valor: v=spf1 include:_spf.resend.com ~all
   
   # DKIM Record (TXT)
   Tipo: TXT
   Nombre: resend._domainkey
   Valor: [Valor proporcionado por Resend]
   
   # DMARC Record (TXT)
   Tipo: TXT
   Nombre: _dmarc
   Valor: v=DMARC1; p=none; rua=mailto:dmarc@tudominio.com
   ```

4. **Espera la verificación** (5-30 minutos)

5. **Actualiza tu `.env`**
   ```env
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_TuApiKey
   EMAIL_FROM_ADDRESS=noreply@tudominio.com  # ← Usa tu dominio verificado
   EMAIL_FROM_NAME=PrintMaster System
   ```

6. **Reinicia el servidor**
   ```bash
   cd gestorimpresoras-Backend
   npm run dev
   ```

✅ **Resultado:** Podrás enviar emails a cualquier destinatario

---

### Opción 2: Usar SMTP (Gmail, Outlook, etc.)

Esta es una alternativa sin necesidad de verificar dominio.

#### Con Gmail:

1. **Habilita autenticación de 2 factores** en tu cuenta de Gmail
   - Ve a: https://myaccount.google.com/security

2. **Genera una contraseña de aplicación**
   ```
   1. Ve a: https://myaccount.google.com/apppasswords
   2. Selecciona "Correo" y "Otro (nombre personalizado)"
   3. Ingresa: "Gestor Impresoras"
   4. Copia la contraseña generada (16 caracteres)
   ```

3. **Actualiza tu `.env`**
   ```env
   EMAIL_PROVIDER=smtp
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=tu-email@gmail.com
   SMTP_PASS=xxxx xxxx xxxx xxxx  # Contraseña de aplicación
   EMAIL_FROM_NAME=PrintMaster System
   EMAIL_FROM_ADDRESS=tu-email@gmail.com
   FRONTEND_URL=http://localhost:3000
   ```

4. **Reinicia el servidor**

✅ **Resultado:** Emails enviados desde tu cuenta de Gmail

**Limitaciones:**
- Gmail: 500 emails/día (gratis), 2000/día (Google Workspace)
- Puede marcar como spam si envías muchos emails

---

#### Con Outlook/Hotmail:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@outlook.com
SMTP_PASS=tu-contraseña
EMAIL_FROM_NAME=PrintMaster System
EMAIL_FROM_ADDRESS=tu-email@outlook.com
```

---

### Opción 3: Solo Testing con Email Registrado (Temporal)

Si solo necesitas probar el sistema y no enviar emails reales a otros usuarios:

1. **Usa el email registrado en Resend**
   
   Solo podrás enviar emails de recuperación al usuario cuyo email sea: `benitezmiguel747@gmail.com`

2. **Crea un usuario de prueba con ese email**
   ```bash
   # En MongoDB o desde el sistema
   email: benitezmiguel747@gmail.com
   username: testuser
   password: test123
   ```

3. **Envía recuperación a ese usuario**

✅ **Resultado:** Email llegará correctamente en modo sandbox

**Limitaciones:**
- Solo funciona para UN email específico
- No es útil para producción
- No puedes probar con otros destinatarios

---

## 🎯 Comparación de Opciones

| Característica | Resend + Dominio | SMTP (Gmail) | Sandbox |
|----------------|------------------|--------------|---------|
| **Costo** | $10-15/año (dominio) | Gratis | Gratis |
| **Setup** | Medio (DNS) | Fácil | Ya configurado |
| **Destinatarios** | Ilimitados | Cualquiera | Solo 1 email |
| **Límites** | 100 emails/día (gratis) | 500/día | Ilimitado |
| **Profesional** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ |
| **Deliverability** | Excelente | Bueno | Excelente |
| **Para producción** | ✅ Recomendado | ✅ Aceptable | ❌ No |

---

## 🚀 Recomendación

**Para desarrollo/testing:** Usa SMTP con Gmail (Opción 2)

**Para producción:** Verifica un dominio en Resend (Opción 1)

---

## 🧪 Verificar Configuración

Después de configurar, prueba el envío:

1. **Inicia el sistema**
   ```bash
   cd gestorimpresoras-Backend
   npm run dev
   ```

2. **Abre el frontend**
   ```
   http://localhost:3000
   ```

3. **Login como admin**
   ```
   Usuario: admin@printmaster.local
   Password: admin123
   ```

4. **Envía un email de recuperación**
   ```
   1. Menú → Usuarios
   2. Selecciona un usuario
   3. Click en 📧 "Enviar mail recuperación"
   ```

5. **Verifica la consola del backend**
   
   **Éxito (200):**
   ```
   ✅ [EMAIL] Email enviado a usuario@example.com via Resend
   ```
   
   **Error 403 (sandbox):**
   ```
   ❌ [EMAIL] Error Resend (403) - testing emails only
   ```

---

## 📝 Variables de Entorno Completas

### Resend (Producción)
```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_TuApiKeyReal
EMAIL_FROM_NAME=PrintMaster System
EMAIL_FROM_ADDRESS=noreply@tudominio.com
FRONTEND_URL=https://impresoras.tudominio.com
```

### SMTP Gmail
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
EMAIL_FROM_NAME=PrintMaster System
EMAIL_FROM_ADDRESS=tu-email@gmail.com
FRONTEND_URL=http://localhost:3000
```

---

## 🆘 Troubleshooting

### Error: "Resend API Key no configurada"
```bash
# Verifica que el archivo .env tiene:
RESEND_API_KEY=re_...
EMAIL_PROVIDER=resend

# Reinicia el servidor
```

### Error: "SMTP Authentication failed"
```bash
# Gmail: Verifica que usas contraseña de aplicación, no tu contraseña normal
# Ve a: https://myaccount.google.com/apppasswords
```

### Error: "Connection timeout" (Resend)
```bash
# Verifica conexión a internet
curl https://api.resend.com/emails

# Verifica firewall no bloquea puerto 443
```

### Email llega a spam
```bash
# Resend: Verifica SPF, DKIM, DMARC en tu dominio
# SMTP: Usa "Responder a" igual al remitente
```

---

## 📞 Soporte

¿Necesitas ayuda?

- **Resend Docs:** https://resend.com/docs
- **Resend Support:** support@resend.com
- **Gmail App Passwords:** https://support.google.com/accounts/answer/185833
- **Issues GitHub:** [Reportar problema](https://github.com/Akashingo94/gestorimpresoras-backend/issues)

---

**Actualizado:** Enero 2026
