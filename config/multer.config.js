/**
 * Multer Configuration
 * Configuración de subida de archivos
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const appConfig = require('./app.config');

// Crear carpeta uploads si no existe
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Crear carpeta avatars si no existe
const avatarsDir = path.join(uploadDir, 'avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir);
}

// Configurar almacenamiento en disco
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Si el campo es avatar, guardarlo en uploads/avatars
    if (file.fieldname === 'avatar') {
      cb(null, avatarsDir);
    } else {
      cb(null, uploadDir);
    }
  },
  filename: function (req, file, cb) {
    // Nombre único: timestamp-nombreOriginal
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: appConfig.fileUploadLimit }
});

module.exports = {
  upload,
  uploadDir
};
