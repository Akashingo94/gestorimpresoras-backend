/**
 * Upload Routes
 * Endpoints para subida de archivos
 */

const express = require('express');

module.exports = function createUploadRoutes(upload) {
  const router = express.Router();

  // POST /api/upload - Subir archivo
  router.post('/', upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }
    
    // Devolver la URL relativa del archivo guardado
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ 
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  });

  return router;
};
