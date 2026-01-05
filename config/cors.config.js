/**
 * CORS Configuration
 * Configuración de Cross-Origin Resource Sharing
 */

const corsOptions = {
  origin: [
    'http://localhost:3000', 
    'http://localhost:5173',
    process.env.FRONTEND_URL || 'https://gestorimpresoras-frontend.vercel.app'
  ],
  credentials: true
};

module.exports = corsOptions;
