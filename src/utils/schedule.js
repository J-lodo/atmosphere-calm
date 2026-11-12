const Announcement = require('../models/Announcement');

const isValidTimeZone = (timeZone) => {
  if (!timeZone || typeof timeZone !== 'string' || timeZone.length > 64) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format(0);
    return true;
  } catch (_err) {
    return false;
  }
};

const fail = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

const parseInstant = (value, label) => {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw fail(`${label} est invalide`);
  return date;
};

// Dates are instants. The timezone is stored beside them so the form can
// show the same wall-clock time the administrator chose.
const readSchedule = (body = {}) => {
  const startsAt = parseInstant(body.startsAt, 'La date de début');
  const endsAt = parseInstant(body.endsAt, 'La date de fin');
  const timezone = String(body.timezone ?? '').trim();
  if ((startsAt || endsAt) && !isValidTimeZone(timezone)) {
    throw fail('Choisissez un fuseau horaire.');
  }
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    throw fail('La fin doit être après le début.');
  }
  return {
    startsAt,
    endsAt,
    timezone: startsAt || endsAt ? timezone : '',
  };
};

const hasScheduleFields = (body = {}) => (
  Object.prototype.hasOwnProperty.call(body, 'startsAt')
  || Object.prototype.hasOwnProperty.call(body, 'endsAt')
  || Object.prototype.hasOwnProperty.call(body, 'timezone')
);

async function syncSchedules(now = new Date()) {
  await Announcement.updateMany(
    { status: 'active', endsAt: { $ne: null, $lte: now } },
    { $set: { status: 'stopped', stoppedAt: now }, $unset: { activeSlot: 1 } },
  );
  await Announcement.updateMany(
    { status: 'scheduled', endsAt: { $ne: null, $lte: now } },
    { $set: { status: 'stopped', stoppedAt: now }, $unset: { activeSlot: 1 } },
  );

  const due = await Announcement.find({
    status: 'scheduled',
    startsAt: { $ne: null, $lte: now },
    $or: [{ endsAt: null }, { endsAt: { $gt: now } }],
  }).sort({ startsAt: 1, createdAt: 1 });

  const started = [];
  for (const doc of due) {
    try {
      await Announcement.updateMany(
        { _id: { $ne: doc._id }, status: 'active' },
        { $set: { status: 'stopped', stoppedAt: now }, $unset: { activeSlot: 1 } },
      );
      const updated = await Announcement.updateOne(
        { _id: doc._id, status: 'scheduled' },
        {
          $set: { status: 'active', activeSlot: 'live', launchedAt: now },
          $unset: { stoppedAt: 1 },
        },
      );
      if (updated.modifiedCount) started.push(String(doc._id));
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  }
  return { started };
}

module.exports = {
  isValidTimeZone,
  readSchedule,
  hasScheduleFields,
  syncSchedules,
};
