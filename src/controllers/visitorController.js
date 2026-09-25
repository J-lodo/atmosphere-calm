const Visitor = require('../models/Visitor');
const { parseUserAgent } = require('../utils/userAgent');
const { lookupIp, normalizeIp } = require('../utils/geoip');
const { reverseGeocode } = require('../utils/reverseGeocode');

// A visitor is "online" when its last heartbeat is more recent than this.
const ONLINE_WINDOW_MS = 150 * 1000;
const VISITOR_ID = /^[A-Za-z0-9-]{8,64}$/;

const toNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function readGps(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const lat = toNumber(raw.lat);
  const lng = toNumber(raw.lng);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const accuracy = toNumber(raw.accuracy);
  return {
    lat: Math.round(lat * 1e5) / 1e5,
    lng: Math.round(lng * 1e5) / 1e5,
    accuracy: accuracy === null ? null : Math.round(accuracy),
    at: new Date(),
    city: null,
    region: null,
    country: null,
    countryCode: null,
  };
}

const EMPTY_GPS = {
  lat: null, lng: null, accuracy: null, at: null, city: null, region: null, country: null, countryCode: null,
};

// Adds city/country to a stored GPS position (only if the position did not change meanwhile).
async function fillGpsPlace(id, lat, lng) {
  const place = await reverseGeocode(lat, lng);
  if (!place) return;
  await Visitor.updateOne(
    { _id: id, 'gps.lat': lat, 'gps.lng': lng },
    {
      $set: {
        'gps.city': place.city,
        'gps.region': place.region,
        'gps.country': place.country,
        'gps.countryCode': place.countryCode,
      },
    }
  );
}

exports.heartbeat = async (req, res, next) => {
  try {
    const visitorId = typeof req.body?.visitorId === 'string' ? req.body.visitorId : '';
    if (!VISITOR_ID.test(visitorId)) return res.status(400).json({ message: 'visitorId invalide' });

    const ip = normalizeIp(req.ip);
    const userAgent = String(req.get('user-agent') || '').slice(0, 400);
    const device = parseUserAgent(userAgent);
    // iPadOS Safari announces itself as a Mac: the client tells us about touch support.
    if (req.body?.touch === true && device.os === 'macOS') {
      device.os = 'iOS';
      device.kind = 'tablet';
    }
    const currentPath = typeof req.body?.path === 'string' ? req.body.path.slice(0, 200) : '/';
    const now = new Date();

    const update = {
      $set: { ip, userAgent, device, currentPath, lastSeen: now },
      $setOnInsert: { visitorId, firstSeen: now },
    };
    if (req.body?.newSession === true) update.$inc = { visits: 1 };

    const consent = req.body?.gpsConsent;
    let newGps = null;
    if (consent === 'denied') {
      update.$set.gpsConsent = 'denied';
      update.$set.gps = EMPTY_GPS;
    } else if (consent === 'granted') {
      update.$set.gpsConsent = 'granted';
      newGps = readGps(req.body?.gps);
      if (newGps) update.$set.gps = newGps;
    }

    const visitor = await Visitor.findOneAndUpdate({ visitorId }, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
    if (visitor.visits < 1) await Visitor.updateOne({ _id: visitor._id }, { $set: { visits: 1 } });

    res.status(204).end();

    if (visitor.locatedIp !== ip) {
      const location = await lookupIp(ip);
      if (location) {
        await Visitor.updateOne({ _id: visitor._id }, { $set: { location, locatedIp: ip } });
      }
    }
    if (newGps) await fillGpsPlace(visitor._id, newGps.lat, newGps.lng);
    return undefined;
  } catch (err) {
    if (res.headersSent) {
      console.error('visitor heartbeat', err);
      return undefined;
    }
    return next(err);
  }
};

exports.list = async (req, res, next) => {
  try {
    const now = Date.now();
    const [visitors, total, last24h, countries, gpsShared] = await Promise.all([
      Visitor.find().sort({ lastSeen: -1 }).limit(500).lean(),
      Visitor.countDocuments(),
      Visitor.countDocuments({ lastSeen: { $gte: new Date(now - 24 * 60 * 60 * 1000) } }),
      Visitor.distinct('location.countryCode', { 'location.countryCode': { $ne: null } }),
      Visitor.countDocuments({ gpsConsent: 'granted', 'gps.lat': { $ne: null } }),
    ]);

    // Positions stored before their city was known: geocode them in the background (throttled).
    visitors
      .filter((v) => v.gps?.lat != null && !v.gps.city)
      .forEach((v) => { fillGpsPlace(v._id, v.gps.lat, v.gps.lng).catch(() => {}); });

    const rows = visitors.map((v) => ({
      id: v._id,
      ip: v.ip,
      device: v.device,
      location: v.location,
      gpsConsent: v.gpsConsent,
      gps: v.gps?.lat != null ? v.gps : null,
      currentPath: v.currentPath,
      visits: v.visits,
      firstSeen: v.firstSeen,
      lastSeen: v.lastSeen,
      online: now - new Date(v.lastSeen).getTime() < ONLINE_WINDOW_MS,
    }));

    res.json({
      onlineWindowSeconds: ONLINE_WINDOW_MS / 1000,
      stats: {
        online: rows.filter((r) => r.online).length,
        last24h,
        total,
        countries: countries.length,
        gpsShared,
      },
      visitors: rows,
    });
  } catch (err) {
    next(err);
  }
};

// Admin diagnostic: shows how the client IP is derived, to check TRUST_PROXY once deployed.
exports.ipCheck = (req, res) => {
  res.json({
    ip: normalizeIp(req.ip),
    ips: req.ips,
    remoteAddress: normalizeIp(req.socket?.remoteAddress),
    xForwardedFor: req.get('x-forwarded-for') || null,
    trustProxy: req.app.get('trust proxy'),
  });
};
