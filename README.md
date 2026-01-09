# 🖨️ Gestor de Impresoras - Backend API

Backend RESTful para sistema de gestión y monitoreo de impresoras en red mediante protocolo SNMP v2c.

![Version](https://img.shields.io/badge/version-1.2.1-blue.svg)
![Node](https://img.shields.io/badge/node-22.21.1-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

---

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Tecnologías](#️-tecnologías)
- [Requisitos](#-requisitos)
- [Instalación](#-instalación)
- [Configuración](#️-configuración)
- [Ejecución](#-ejecución)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [API Endpoints](#-api-endpoints)
- [Sistema SNMP](#-sistema-snmp)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Características

### 🔐 Autenticación y Autorización
- Sistema RBAC con 3 roles (ADMIN, TECHNICIAN, PENDING)
- Gestión de usuarios con soft delete
- Sesiones persistentes con MongoDB
- Recuperación de contraseña con tokens criptográficos
- Passwords hasheados con bcrypt
- **Preferencias de usuario**: Tema y fuentes personalizadas por usuario
- **Configuración del sistema**: Logo y branding global (solo admin)

### 📊 Monitoreo SNMP
- Detección automática de impresoras en red
- Soporte multi-marca (Brother, Ricoh, HP, Pantum)
- Consulta de niveles de tóner/tinta en tiempo real
- Estado de dispositivos y contadores de páginas
- Sistema de parsers modulares por fabricante
- **Auto-reconexión resiliente**: El servidor continúa operando si MongoDB se cae
- **Health monitoring**: Endpoint de salud con estado de base de datos

### 🛠️ Gestión de Mantenimiento
- Registro completo de mantenimientos
- Upload de documentos (facturas, reportes)
- Historial de actividades
- System logs para auditoría

### 🤖 Inteligencia Artificial
- Integración con Gemini AI
- Análisis predictivo de consumibles
- Recomendaciones automáticas

---

## 🛠️ Tecnologías

```
Node.js v22.21.1        - Runtime JavaScript
Express.js 4.x          - Framework web
Mongoose 8.x            - ODM para MongoDB
net-snmp 3.x            - Protocolo SNMP v2c
express-session 1.18.x  - Gestión de sesiones
connect-mongo 6.0.0     - Store MongoDB para sesiones
multer 2.x              - Carga de archivos
cors 2.x                - CORS middleware
bcrypt 6.x              - Hash de contraseñas
nodemailer 7.x          - Envío de emails
```

---

## 💻 Requisitos

### Software
- **Node.js**: >= 18.0.0 (recomendado: 22.21.1)
- **MongoDB**: >= 6.0 (OBLIGATORIO - instalación local recomendada)
- **npm**: >= 8.0.0

### Red
- Puerto **4000** para API (configurable)
- Puerto **161 UDP** para SNMP
- Firewall configurado para permitir tráfico SNMP

---

## 🚀 Instalación

### 1. Clonar el Repositorio

```bash
git clone https://github.com/Akashingo94/gestorimpresoras-backend.git
cd gestorimpresoras-backend
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Instalar MongoDB (si no está instalado)

**Windows:**
- Descargar de [mongodb.com](https://www.mongodb.com/try/download/community)
- Instalar como servicio de Windows
- Por defecto corre en `localhost:27017`

**Linux/Mac:**
```bash
# Ubuntu/Debian
sudo apt-get install mongodb-org

# macOS (Homebrew)
brew tap mongodb/brew
brew install mongodb-community
```

---

## ⚙️ Configuración

### Archivo `.env`

Crear archivo `.env` en la raíz del proyecto:

```env
# MongoDB (OBLIGATORIO - Conexión local recomendada)
MONGO_URI=mongodb://localhost:27017/printmaster_db

# Puerto del servidor
PORT=4000

# Modo de desarrollo
NODE_ENV=development

# Gemini AI (Opcional - para análisis predictivo)
GEMINI_API_KEY=tu_api_key_de_gemini

# Email Service - Opción 1: Resend (Recomendado)
EMAIL_SERVICE=resend
RESEND_API_KEY=tu_api_key_de_resend
EMAIL_FROM=noreply@tudominio.com

# Email Service - Opción 2: SMTP (Alternativa)
# EMAIL_SERVICE=smtp
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=tu_email@gmail.com
# SMTP_PASS=tu_password_de_aplicación
# EMAIL_FROM=tu_email@gmail.com

# Session Secret (Cambiar en producción)
SESSION_SECRET=cambiar_esto_por_un_secret_seguro_en_produccion
```

### Variables Importantes

| Variable | Descripción | Valor por Defecto |
|----------|-------------|-------------------|
| `MONGO_URI` | Conexión MongoDB | `mongodb://localhost:27017/printmaster_db` |
| `PORT` | Puerto del servidor | `4000` |
| `NODE_ENV` | Entorno | `development` |
| `SESSION_SECRET` | Secret para sesiones | (requerido) |
| `EMAIL_SERVICE` | Servicio de email | `resend` o `smtp` |

---

## 🎯 Ejecución

### Desarrollo (con nodemon)
```bash
npm run dev
```

### Producción
```bash
npm start
```

### Verificar MongoDB
```bash
npm run check-db
```

El servidor iniciará en `http://localhost:4000`

---

## 📁 Estructura del Proyecto

```
gestorimpresoras-Backend/
├── config/
│   ├── app.config.js           # Configuración general
│   ├── cors.config.js          # Configuración CORS
│   ├── database.config.js      # Conexión MongoDB
│   ├── multer.config.js        # Upload de archivos
│   └── session.config.js       # Sesiones
├── controllers/
│   ├── authController.js       # Autenticación
│   ├── logController.js        # Logs de mantenimiento
│   ├── networkController.js    # Escaneo de red
│   ├── printerController.js    # Gestión de impresoras
│   ├── systemLogController.js  # System logs
│   └── userController.js       # Gestión de usuarios
├── middleware/
│   ├── auth.js                 # Autenticación y RBAC
│   └── requestLogger.js        # Log de peticiones
├── models/
│   ├── Log.js                  # Modelo de logs
│   ├── Printer.js              # Modelo de impresoras
│   ├── SystemConfig.js         # Configuración global del sistema
│   └── User.js                 # Modelo de usuarios
├── routes/
│   ├── authRoutes.js           # Rutas de auth
│   ├── healthRoutes.js         # Health check
│   ├── logRoutes.js            # Rutas de logs
│   ├── networkRoutes.js        # Escaneo de red
│   ├── printerRoutes.js        # CRUD impresoras
│   ├── systemConfigRoutes.js   # Configuración del sistema
│   ├── systemLogRoutes.js      # System logs
│   ├── uploadRoutes.js         # Upload de archivos
│   ├── userRoutes.js           # CRUD usuarios
│   └── index.js                # Montado de rutas
├── services/
│   ├── snmpCore.js             # Core SNMP
│   ├── snmpQueryService.js     # Queries SNMP
│   ├── snmpService.js          # Servicio principal
│   ├── snmpUtils.js            # Utilidades SNMP
│   └── printers/
│       ├── brotherParser.js    # Parser Brother
│       ├── genericParser.js    # Parser genérico
│       ├── pantumParser.js     # Parser Pantum
│       └── ricohParser.js      # Parser Ricoh
├── uploads/                    # Archivos subidos
├── utils/
│   ├── logger.js               # Sistema de logs
│   └── network.js              # Utilidades de red
├── check-mongodb.js            # Script verificación DB
├── nodemon.json                # Config nodemon
├── package.json
└── server.js                   # Punto de entrada
```

---

## 🔌 API Endpoints

### Autenticación
```
POST   /api/auth/register          - Registro de usuario
POST   /api/auth/login             - Login
POST   /api/auth/logout            - Logout
GET    /api/auth/me                - Usuario actual
POST   /api/auth/forgot-password   - Solicitar reset
POST   /api/auth/reset-password    - Resetear contraseña
PUT    /api/auth/profile           - Actualizar perfil
PUT    /api/auth/change-password   - Cambiar contraseña
```

### Impresoras
```
GET    /api/printers               - Listar impresoras
POST   /api/printers               - Crear impresora
GET    /api/printers/:id           - Obtener impresora
PUT    /api/printers/:id           - Actualizar impresora
DELETE /api/printers/:id           - Eliminar impresora
GET    /api/printers/:id/status    - Estado SNMP en tiempo real
```

### Red
```
POST   /api/network/scan           - Escanear red
POST   /api/network/query          - Consulta SNMP específica
```

### Logs de Mantenimiento
```
GET    /api/logs                   - Listar logs
POST   /api/logs                   - Crear log
GET    /api/logs/:id               - Obtener log
PUT    /api/logs/:id               - Actualizar log
DELETE /api/logs/:id               - Eliminar log
```

### System Logs (Solo ADMIN)
```
GET    /api/system-logs            - Logs del sistema
GET    /api/system-logs/stream     - Stream SSE en tiempo real
```

### Usuarios (Solo ADMIN)
```
GET    /api/users                  - Listar usuarios
PUT    /api/users/:id              - Actualizar usuario
DELETE /api/users/:id              - Eliminar usuario
PATCH  /api/users/:id/approve      - Aprobar usuario
GET    /api/users/preferences      - Obtener preferencias del usuario (Auth)
PUT    /api/users/preferences      - Actualizar preferencias (Auth)
```

### Configuración del Sistema
```
GET    /api/system/config          - Obtener configuración global (Público)
PUT    /api/system/config          - Actualizar configuración (Solo ADMIN)
```

### Health Check
```
GET    /health                     - Estado del servidor
GET    /api/health                 - Estado detallado (DB, memoria, uptime)
```

---

## 📡 Sistema SNMP

### OIDs Soportados

**Información General:**
```
1.3.6.1.2.1.1.1.0   - sysDescr (Descripción)
1.3.6.1.2.1.1.5.0   - sysName (Nombre)
1.3.6.1.2.1.25.3.2.1.3.1 - hrDeviceStatus (Estado)
```

**Contadores de Páginas:**
```
1.3.6.1.2.1.43.10.2.1.4.1.1  - Páginas totales
1.3.6.1.4.1.2435.2.3.9.4.2.1.5.5.8.0 - Brother contador
```

**Niveles de Tóner:**
```
1.3.6.1.2.1.43.11.1.1.8.1.x - Nivel máximo
1.3.6.1.2.1.43.11.1.1.9.1.x - Nivel actual
```

### Parsers por Marca

- **Brother**: OIDs específicos para series DCP, HL, MFC
- **Ricoh**: Soporte para M 320F y series comerciales
- **HP**: Parser genérico compatible con LaserJet
- **Pantum**: Series monocromáticas y color
- **Generic**: Fallback para marcas no específicas

---

## 🐛 Troubleshooting

### MongoDB no conecta

**Error**: `MongoNetworkError: connect ECONNREFUSED`

**Solución**:
```bash
# Verificar si MongoDB está corriendo
# Windows:
net start MongoDB

# Linux/Mac:
sudo systemctl status mongod
sudo systemctl start mongod
```

### Error de permisos SNMP

**Error**: `RequestFailedError: Timeout`

**Solución**:
1. Verificar que la impresora tenga SNMP habilitado
2. Community string debe ser `public` (read-only)
3. Verificar firewall permite UDP 161
4. Probar con `snmpwalk` desde línea de comandos

### Puerto 4000 en uso

**Error**: `EADDRINUSE: address already in use`

**Solución**:
```bash
# Windows: Matar proceso en puerto 4000
netstat -ano | findstr :4000
taskkill /PID [PID] /F

# Linux/Mac:
lsof -ti:4000 | xargs kill -9
```

### Sesiones no persisten

**Solución**:
1. Verificar MongoDB conectado: `npm run check-db`
2. Verificar colección `sessions` existe en MongoDB
3. Confirmar `SESSION_SECRET` en `.env`
4. Verificar `connect-mongo` v6.0.0 instalado correctamente
5. Limpiar cookies del navegador

**Nota**: El sistema usa `connect-mongo` v6 con `new MongoStore()`. Las sesiones se almacenan en la colección `sessions` de MongoDB, no en memoria.

### MongoDB se desconecta durante operación

**Comportamiento Esperado**: El servidor NO se detiene, entra en "modo degradado".

**Características del sistema de auto-reconexión**:
- El servidor continúa ejecutándose sin crashear
- Intentos de reconexión automáticos cada 5 segundos (con backoff exponencial)
- Las rutas devuelven 503 (Service Unavailable) mientras MongoDB esté caído
- El endpoint `/api/health` siempre responde mostrando el estado real
- Al restaurar MongoDB, el sistema se reconecta automáticamente sin reiniciar

**Para restaurar MongoDB**:
```bash
# Windows:
net start MongoDB

# Linux/Mac:
sudo systemctl start mongod
```

### Migrar configuración del sistema

Si actualizas desde una versión anterior que guardaba el logo en preferencias de usuario:

```bash
# Ejecutar migración para separar configuración global
node migrations/separateSystemConfig.js
```

Esta migración:
- Crea la colección `systemconfigs` con configuración global única
- Migra el logo del primer admin a configuración global
- Limpia el campo `system` de las preferencias de usuarios
- Mantiene temas y fuentes como preferencias personales

### Emails no se envían

**Solución**:
1. Verificar credenciales en `.env`
2. Para Gmail: generar contraseña de aplicación
3. Verificar logs del servidor para errores SMTP

---

## 📝 Licencia

MIT License - Ver archivo LICENSE para más detalles

---

## 👥 Contribución

1. Fork el proyecto
2. Crear branch de feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

---

## 📞 Soporte

Para reportar bugs o solicitar features:
- GitHub Issues: [gestorimpresoras-backend/issues](https://github.com/Akashingo94/gestorimpresoras-backend/issues)

---

**Desarrollado con ❤️ para la gestión eficiente de parques de impresoras**
