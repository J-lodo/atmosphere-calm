const axios = require('axios');

// Approximate location (country, region, city) from an IP address, via ipwho.is (free, no key).
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

function normalizeIp(ip) {
  if (!ip) return null;
  const value = String(ip).trim();
  return value.startsWith('::ffff:') ? value.slice(7) : value;
}

function isPrivateIp(ip) {
  if (!ip) return true;
  return ip === '::1'
    || ip === '127.0.0.1'
    || /^10\./.test(ip)
    || /^192\.168\./.test(ip)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
    || /^169\.254\./.test(ip)
    || /^f[cd][0-9a-f]{2}:/i.test(ip)
    || /^fe80:/i.test(ip);
}

async function lookupIp(rawIp) {
  const ip = normalizeIp(rawIp);
  if (isPrivateIp(ip)) {
    return { country: null, countryCode: null, region: null, city: null, isPrivate: true };
  }

  const hit = cache.get(ip);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  try {
    const { data } = await axios.get(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      params: { lang: 'fr', fields: 'success,country,country_code,region,city' },
      timeout: 4000,
    });
    if (!data?.success) return null;
    const value = {
      country: data.country || null,
      countryCode: data.country_code || null,
      region: data.region || null,
      city: data.city || null,
      isPrivate: false,
    };
    cache.set(ip, { at: Date.now(), value });
    return value;
  } catch (_err) {
    return null;
  }
}

module.exports = { lookupIp, normalizeIp, isPrivateIp };
