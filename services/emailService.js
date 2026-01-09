/**
 * Email Service
 * Servicio para envío de correos electrónicos
 * Soporta SMTP (nodemailer) y Resend API
 */

const nodemailer = require('nodemailer');
const { addSystemLog } = require('../utils/logger');

/**
 * Detectar proveedor de email (SMTP o Resend)
 */
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'smtp';

/**
 * Configuración del servicio de email SMTP
 * Leer desde variables de entorno para mayor seguridad
 */
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true para 465, false para otros puertos
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};

/**
 * Configuración de Resend API
 */
const resendConfig = {
  apiKey: process.env.RESEND_API_KEY
};

/**
 * Información del remitente
 */
const senderInfo = {
  name: process.env.EMAIL_FROM_NAME || 'Gestor de Impresoras',
  email: process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || 'onboarding@resend.dev'
};

/**
 * Envía email usando Resend API
 */
async function sendWithResend({ to, subject, text, html }) {
  if (!resendConfig.apiKey) {
    addSystemLog('warn', 'EMAIL', 'API Key de Resend no configurada');
    console.log('📧 [MODO DESARROLLO] Email que se enviaría:');
    console.log(`   Para: ${to}`);
    console.log(`   Asunto: ${subject}`);
    return { success: false, message: 'Resend API Key no configurada' };
  }

  console.log(`📧 [DEBUG] Intentando enviar email a ${to} via Resend...`);
  console.log(`📧 [DEBUG] API Key: ${resendConfig.apiKey.substring(0, 10)}...`);
  console.log(`📧 [DEBUG] From: ${senderInfo.name} <${senderInfo.email}>`);
  console.log(`📧 [DEBUG] Subject: ${subject}`);

  try {
    // Usar https nativo de Node.js en lugar de fetch
    const https = require('https');
    
    const postData = JSON.stringify({
      from: `${senderInfo.name} <${senderInfo.email}>`,
      to: [to],
      subject,
      text,
      html: html || text
    });

    const options = {
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendConfig.apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              addSystemLog('success', 'EMAIL', `Email enviado a ${to} via Resend`, `ID: ${jsonData.id}`);
              resolve({
                success: true,
                messageId: jsonData.id,
                message: 'Email enviado correctamente'
              });
            } else {
              const errorMsg = jsonData.message || `Error ${res.statusCode}`;
              addSystemLog('error', 'EMAIL', `Error Resend (${res.statusCode}) a ${to}`, errorMsg);
              
              // Error 403: Modo sandbox - solo puede enviar al email registrado
              if (res.statusCode === 403 && errorMsg.includes('testing emails')) {
                const sandboxError = new Error('RESEND_SANDBOX_MODE');
                sandboxError.statusCode = 403;
                sandboxError.details = errorMsg;
                reject(sandboxError);
              } else {
                reject(new Error(errorMsg));
              }
            }
          } catch (parseError) {
            addSystemLog('error', 'EMAIL', `Error parseando respuesta Resend`, parseError.message);
            reject(parseError);
          }
        });
      });

      req.on('error', (error) => {
        console.error(`❌ [DEBUG] Error de conexión detallado:`, {
          code: error.code,
          message: error.message,
          errno: error.errno,
          syscall: error.syscall
        });
        addSystemLog('error', 'EMAIL', `Error de conexión con Resend API`, error.message);
        console.log(`💡 [SUGERENCIA] Verifica:`);
        console.log(`   1. Conexión a internet activa`);
        console.log(`   2. Firewall no bloqueando api.resend.com`);
        console.log(`   3. API Key válida: ${resendConfig.apiKey?.substring(0, 10)}...`);
        console.log(`   4. Considera usar SMTP como alternativa (EMAIL_PROVIDER=smtp)`);
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  } catch (error) {
    addSystemLog('error', 'EMAIL', `Error enviando email via Resend a ${to}`, error.message);
    return {
      success: false,
      message: 'Error al enviar el email',
      error: error.message
    };
  }
}

/**
 * Crea el transporter de nodemailer (SMTP)
 */
function createTransporter() {
  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    addSystemLog('warn', 'EMAIL', 'Credenciales SMTP no configuradas. Los emails no se enviarán.');
    return null;
  }
  
  try {
    const transporter = nodemailer.createTransport(emailConfig);
    return transporter;
  } catch (error) {
    addSystemLog('error', 'EMAIL', 'Error creando transporter de email', error.message);
    return null;
  }
}

/**
 * Envía email usando SMTP (nodemailer)
 */
async function sendWithSMTP({ to, subject, text, html }) {
  const transporter = createTransporter();
  
  if (!transporter) {
    console.log('📧 [MODO DESARROLLO] Email que se enviaría:');
    console.log(`   Para: ${to}`);
    console.log(`   Asunto: ${subject}`);
    console.log(`   Contenido: ${text}`);
    return { success: false, message: 'Servicio de email no configurado' };
  }
  
  try {
    const mailOptions = {
      from: `"${senderInfo.name}" <${senderInfo.email}>`,
      to,
      subject,
      text,
      html: html || text
    };
    
    const info = await transporter.sendMail(mailOptions);
    addSystemLog('success', 'EMAIL', `Email enviado a ${to}`, `ID: ${info.messageId}`);
    
    return { 
      success: true, 
      messageId: info.messageId,
      message: 'Email enviado correctamente'
    };
  } catch (error) {
    addSystemLog('error', 'EMAIL', `Error enviando email a ${to}`, error.message);
    return { 
      success: false, 
      message: 'Error al enviar el email',
      error: error.message
    };
  }
}

/**
 * Envía un email (detecta automáticamente el proveedor)
 * @param {Object} options - Opciones del email
 * @param {string} options.to - Destinatario
 * @param {string} options.subject - Asunto
 * @param {string} options.text - Contenido en texto plano
 * @param {string} options.html - Contenido en HTML
 */
async function sendEmail({ to, subject, text, html }) {
  // Detectar proveedor y enviar
  if (EMAIL_PROVIDER === 'resend') {
    return await sendWithResend({ to, subject, text, html });
  } else {
    return await sendWithSMTP({ to, subject, text, html });
  }
}

/**
 * Envía email de bienvenida a usuario registrado
 */
async function sendWelcomeEmail(user) {
  const subject = 'Bienvenido a Gestor de Impresoras';
  const text = `
Hola ${user.name || user.username},

¡Bienvenido al sistema de Gestor de Impresoras!

Tu cuenta ha sido creada exitosamente y está pendiente de aprobación por un administrador.
Te notificaremos cuando tu cuenta sea activada.

Usuario: ${user.username}

Saludos,
Equipo de Gestor de Impresoras
  `.trim();
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: white; padding: 15px; margin: 20px 0; border-left: 4px solid #4f46e5; }
    .footer { text-align: center; color: #6b7280; margin-top: 20px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>¡Bienvenido!</h1>
    </div>
    <div class="content">
      <p>Hola <strong>${user.name || user.username}</strong>,</p>
      <p>¡Bienvenido al sistema de Gestor de Impresoras!</p>
      <div class="info-box">
        <p><strong>📋 Estado de tu cuenta:</strong></p>
        <p>Tu cuenta ha sido creada exitosamente y está <strong>pendiente de aprobación</strong> por un administrador.</p>
        <p>Te notificaremos cuando tu cuenta sea activada.</p>
      </div>
      <p><strong>Usuario:</strong> ${user.username}</p>
      <p>Saludos,<br><strong>Equipo de Gestor de Impresoras</strong></p>
    </div>
    <div class="footer">
      <p>Este es un email automático, por favor no respondas a este mensaje.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  return sendEmail({
    to: user.email,
    subject,
    text,
    html
  });
}

/**
 * Envía email de recuperación de contraseña
 */
async function sendPasswordResetEmail(user, resetUrl) {
  const subject = 'Recuperación de contraseña - Gestor de Impresoras';
  const text = `
Hola ${user.name || user.username},

Has solicitado restablecer tu contraseña.

Para crear una nueva contraseña, haz clic en el siguiente enlace:
${resetUrl}

Este enlace expirará en 1 hora.

Si no solicitaste este cambio, puedes ignorar este email de forma segura.

Saludos,
Equipo de Gestor de Impresoras
  `.trim();
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; padding: 12px 30px; background: #ef4444; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .button:hover { background: #dc2626; }
    .warning { background: #fef3c7; padding: 15px; margin: 20px 0; border-left: 4px solid #f59e0b; border-radius: 4px; }
    .footer { text-align: center; color: #6b7280; margin-top: 20px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔒 Recuperación de Contraseña</h1>
    </div>
    <div class="content">
      <p>Hola <strong>${user.name || user.username}</strong>,</p>
      <p>Has solicitado restablecer tu contraseña.</p>
      <p>Para crear una nueva contraseña, haz clic en el siguiente botón:</p>
      <center>
        <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
      </center>
      <div class="warning">
        <p><strong>⏱️ Importante:</strong> Este enlace expirará en <strong>1 hora</strong>.</p>
      </div>
      <p style="color: #6b7280; font-size: 14px;">Si no puedes hacer clic en el botón, copia y pega este enlace en tu navegador:</p>
      <p style="word-break: break-all; color: #4f46e5; font-size: 12px;">${resetUrl}</p>
      <p style="margin-top: 30px; color: #6b7280;">Si no solicitaste este cambio, puedes ignorar este email de forma segura.</p>
      <p>Saludos,<br><strong>Equipo de Gestor de Impresoras</strong></p>
    </div>
    <div class="footer">
      <p>Este es un email automático, por favor no respondas a este mensaje.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  return sendEmail({
    to: user.email,
    subject,
    text,
    html
  });
}

/**
 * Envía email de confirmación de cambio de contraseña
 */
async function sendPasswordChangedEmail(user) {
  const subject = 'Contraseña cambiada exitosamente';
  const text = `
Hola ${user.name || user.username},

Tu contraseña ha sido cambiada exitosamente.

Si no fuiste tú quien realizó este cambio, contacta inmediatamente con el administrador del sistema.

Saludos,
Equipo de Gestor de Impresoras
  `.trim();
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .alert { background: #fef2f2; padding: 15px; margin: 20px 0; border-left: 4px solid #ef4444; border-radius: 4px; }
    .footer { text-align: center; color: #6b7280; margin-top: 20px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Contraseña Actualizada</h1>
    </div>
    <div class="content">
      <p>Hola <strong>${user.name || user.username}</strong>,</p>
      <p>Tu contraseña ha sido cambiada exitosamente.</p>
      <div class="alert">
        <p><strong>⚠️ Importante:</strong></p>
        <p>Si <strong>no fuiste tú</strong> quien realizó este cambio, contacta inmediatamente con el administrador del sistema.</p>
      </div>
      <p>Saludos,<br><strong>Equipo de Gestor de Impresoras</strong></p>
    </div>
    <div class="footer">
      <p>Este es un email automático, por favor no respondas a este mensaje.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  return sendEmail({
    to: user.email,
    subject,
    text,
    html
  });
}

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail
};
