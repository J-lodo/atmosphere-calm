const axios = require('axios');

// City/country from GPS coordinates via OpenStreetMap Nominatim.
// Usage policy: identifying User-Agent, at most 1 request per second, results cached.
const MIN_INTERVAL_MS = 1100;
const RETRY_AFTER_MS = 60 * 60 * 1000;
const USER_AGENT = `Atmosphere-ALCM/1.0 (${process.env.NOMINATIM_CONTACT || 'https://github.com/J-lodo/atmosphere-calm'})`;

const cache = new Map(); // "lat,lng" rounded to ~100 m -> place | null
const failures = new Map(); // key -> timestamp of last failure
const pending = new Map();
let queue = Promise.resolve();
let lastCall = 0;

const keyOf = (lat, lng) => `${lat.toFixed(3)},${lng.toFixed(3)}`;
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const throttled = (fn) => {
  const run = queue.then(async () => {
    const wait = lastCall + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    return fn();
  });
  queue = run.catch(() => {});
  return run;
};

async function fetchPlace(lat, lng) {
  const { data } = await axios.get('https://nominatim.openstreetmap.org/reverse', {
    params: {
      format: 'jsonv2', lat, lon: lng, zoom: 10, addressdetails: 1, 'accept-language': 'fr',
    },
    headers: { 'User-Agent': USER_AGENT },
    timeout: 8000,
  });
  const a = data?.address || {};
  const city = a.city || a.town || a.village || a.municipality || a.city_district || a.county || null;
  if (!city && !a.country) return null;
  return {
    city,
    region: a.state || a.region || null,
    country: a.country || null,
    countryCode: a.country_code ? a.country_code.toUpperCase() : null,
  };
}

// Returns { city, region, country, countryCode } or null. Never throws.
async function reverseGeocode(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const key = keyOf(lat, lng);
  if (cache.has(key)) return cache.get(key);
  if (Date.now() - (failures.get(key) || 0) < RETRY_AFTER_MS) return null;
  if (pending.has(key)) return pending.get(key);

  const job = throttled(() => fetchPlace(lat, lng))
    .then((place) => {
      cache.set(key, place);
      return place;
    })
    .catch(() => {
      failures.set(key, Date.now());
      return null;
    })
    .finally(() => pending.delete(key));
  pending.set(key, job);
  return job;
}

module.exports = { reverseGeocode };
