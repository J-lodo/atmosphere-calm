const axios = require('axios');

// Location (country, region, city) from an IP address, without GPS.
// db-ip.com (free, no key, 1000 requests/day) is the most precise for our visitors
// (e.g. Longueuil where ipwho.is says Hawkesbury); ipwho.is is the fallback.
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

const COUNTRY_NAMES_FR = new Intl.DisplayNames(['fr'], { type: 'region' });
const COUNTRY_OVERRIDES = { CD: 'République démocratique du Congo', CG: 'République du Congo' };
// db-ip answers in English; French names for the regions our visitors come from.
const REGION_FR = { Quebec: 'Québec', 'British Columbia': 'Colombie-Britannique', 'Nova Scotia': 'Nouvelle-Écosse', 'New Brunswick': 'Nouveau-Brunswick' };
const countryFr = (code, fallback) => {
  if (!code) return fallback || null;
  try {
    return COUNTRY_OVERRIDES[code] || COUNTRY_NAMES_FR.of(code) || fallback || null;
  } catch (_err) {
    return fallback || null;
  }
};

async function fromDbIp(ip) {
  try {
    const { data } = await axios.get(`https://api.db-ip.com/v2/free/${encodeURIComponent(ip)}`, { timeout: 4000 });
    if (!data || data.error || (!data.city && !data.countryCode)) return null;
    return {
      country: countryFr(data.countryCode, data.countryName),
      countryCode: data.countryCode || null,
      region: REGION_FR[data.stateProv] || data.stateProv || null,
      // "Castelnau-de-Lévis (France)": drop the country repeated after the city name.
      city: data.city ? data.city.replace(` (${data.countryName})`, '') : null,
      isPrivate: false,
    };
  } catch (_err) {
    return null;
  }
}

async function fromIpWho(ip) {
  try {
    const { data } = await axios.get(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      params: { lang: 'fr', fields: 'success,country,country_code,region,city' },
      timeout: 4000,
    });
    if (!data?.success) return null;
    return {
      country: countryFr(data.country_code, data.country),
      countryCode: data.country_code || null,
      region: data.region || null,
      city: data.city || null,
      isPrivate: false,
    };
  } catch (_err) {
    return null;
  }
}

async function lookupIp(rawIp) {
  const ip = normalizeIp(rawIp);
  if (isPrivateIp(ip)) {
    return { country: null, countryCode: null, region: null, city: null, isPrivate: true };
  }

  const hit = cache.get(ip);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const value = (await fromDbIp(ip)) || (await fromIpWho(ip));
  if (value) cache.set(ip, { at: Date.now(), value });
  return value;
}

module.exports = { lookupIp, normalizeIp, isPrivateIp };
