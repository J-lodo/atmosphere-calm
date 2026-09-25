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

// Express `trust proxy`: decides whether X-Forwarded-For is used to get the client IP.
// TRUST_PROXY accepts a hop count ("1"), "true"/"false", or names/CIDRs ("loopback", "10.0.0.0/8").
// Default: 1 in production (one reverse proxy, e.g. Render), "loopback" in development
// (only the local CRA dev proxy is trusted, so LAN clients cannot spoof their IP).
function getTrustProxy() {
  const raw = process.env.TRUST_PROXY?.trim();
  if (!raw) return isProduction ? 1 : 'loopback';
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
}

module.exports = {
  isProduction,
  validateEnv,
  getAllowedOrigins,
  getTrustProxy,
};
