const isProduction = process.env.NODE_ENV === 'production';

function validateEnv() {
  const required = ['MONGODB_URI', 'JWT_SECRET'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes : ${missing.join(', ')}`);
  }

  if (process.env.JWT_SECRET.length < 32) {
    console.warn('JWT_SECRET devrait contenir au moins 32 caractères en production.');
  }
}

function getAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS;
  if (!raw) return null;
  return raw.split(',').map((origin) => origin.trim()).filter(Boolean);
}

module.exports = {
  isProduction,
  validateEnv,
  getAllowedOrigins,
};
