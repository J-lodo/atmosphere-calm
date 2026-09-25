const mongoose = require('mongoose');

const RETENTION_DAYS = Number(process.env.VISITOR_RETENTION_DAYS) || 90;

// One document per browser (visitorId is a random id kept in the browser's localStorage).
const VisitorSchema = new mongoose.Schema({
  visitorId: { type: String, required: true, unique: true },
  ip: { type: String, default: null },
  userAgent: { type: String, default: '' },
  device: {
    kind: { type: String, default: 'desktop' }, // 'mobile' | 'tablet' | 'desktop'
    os: { type: String, default: '' },
    browser: { type: String, default: '' },
  },
  location: {
    country: { type: String, default: null },
    countryCode: { type: String, default: null },
    region: { type: String, default: null },
    city: { type: String, default: null },
    isPrivate: { type: Boolean, default: false },
  },
  // IP for which `location` was resolved, to avoid repeated lookups.
  locatedIp: { type: String, default: null },
  // GPS is only stored after the visitor explicitly accepted, once.
  gpsConsent: { type: String, enum: ['granted', 'denied', null], default: null },
  gps: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    accuracy: { type: Number, default: null },
    at: { type: Date, default: null },
    // filled by reverse geocoding (Nominatim)
    city: { type: String, default: null },
    region: { type: String, default: null },
    country: { type: String, default: null },
    countryCode: { type: String, default: null },
  },
  currentPath: { type: String, default: '/' },
  visits: { type: Number, default: 0 }, // sessions (one per opened tab)
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
});

VisitorSchema.index({ lastSeen: -1 });
VisitorSchema.index({ lastSeen: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60, name: 'visitor_retention' });

module.exports = mongoose.model('Visitor', VisitorSchema);
