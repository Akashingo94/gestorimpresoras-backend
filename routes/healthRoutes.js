/**
 * Health Routes
 * Endpoints de estado del servidor
 */

const express = require('express');
const mongoose = require('mongoose');
const { getLocalIp } = require('../utils/network');
const { isDatabaseConnected } = require('../config/database.config');

module.exports = function createHealthRoutes(appConfig) {
  const router = express.Router();

  // GET / - Mensaje de bienvenida
  router.get('/', (req, res) => {
    res.send(`GestorImpresoras Backend is RUNNING on port ${appConfig.port}`);
  });

  // GET /api/health - Health check completo
  router.get('/health', (req, res) => {
    const dbConnected = isDatabaseConnected();
    const dbState = mongoose.connection.readyState;
    const dbStateMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    const health = {
      status: dbConnected ? 'OK' : 'DEGRADED',
      service: 'GestorImpresoras Backend',
      port: appConfig.port,
      ip: getLocalIp(),
      timestamp: new Date().toISOString(),
      database: {
        connected: dbConnected,
        state: dbStateMap[dbState] || 'unknown',
        type: appConfig.mongoUri.includes('mongodb.net') ? 'MongoDB Atlas' : 'MongoDB Local'
      },
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      }
    };

    const statusCode = dbConnected ? 200 : 503;
    res.status(statusCode).json(health);
  });

  return router;
};
