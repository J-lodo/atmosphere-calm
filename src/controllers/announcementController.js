const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const {
  WHATSAPP_MESSAGE,
  normalizeWhatsappNumber,
  isInternationalWhatsappNumber,
} = require('../utils/whatsappNumber');
const { readSchedule, hasScheduleFields, syncSchedules, isValidTimeZone } = require('../utils/schedule');

const SEED_KEY = 'repertoire-cantiques';
const SEED_TITLE = 'Aidez-nous à enrichir le répertoire de cantiques';
const SEED_BODY = `Bien-aimés frères et sœurs,

Nous souhaitons enrichir le répertoire d’Atmosphère pour que toute l’assemblée puisse y retrouver davantage de cantiques. Si vous vous sentez à cœur de participer en ajoutant des cantiques à l’application, écrivez-nous sur WhatsApp. Nous vous expliquerons comment contribuer.

Merci pour votre aide. Que Dieu vous bénisse !`;

const STATUS_ORDER = { active: 0, scheduled: 1, draft: 2, stopped: 3 };

const presentAdmin = (doc) => ({
  id: String(doc._id),
  title: doc.title || '',
  body: doc.body || '',
  whatsappNumber: doc.whatsappNumber || '',
  status: doc.status,
  startsAt: doc.startsAt || null,
  endsAt: doc.endsAt || null,
  timezone: doc.timezone || '',
  launchedAt: doc.launchedAt || null,
  stoppedAt: doc.stoppedAt || null,
  createdAt: doc.createdAt || null,
  updatedAt: doc.updatedAt || null,
  seed: doc.seedKey === SEED_KEY,
});

const presentPublic = (doc) => ({
  id: String(doc._id),
  title: doc.title || '',
  body: doc.body || '',
  whatsappNumber: doc.whatsappNumber || '',
  whatsappMessage: WHATSAPP_MESSAGE,
});

const readText = (value, max, label) => {
  const text = String(value ?? '').trim();
  if (text.length > max) {
    const error = new Error(`${label} est trop long (${max} caractères maximum)`);
    error.status = 400;
    throw error;
  }
  return text;
};

const readNumber = (value, { required = false } = {}) => {
  const number = normalizeWhatsappNumber(value);
  if (!number) {
    if (required) {
      const error = new Error('Indiquez un numéro WhatsApp au format international avant de lancer');
      error.status = 400;
      throw error;
    }
    return '';
  }
  if (number.length > 32 || !isInternationalWhatsappNumber(number)) {
    const error = new Error('Le numéro WhatsApp doit être au format international, par exemple commencer par +');
    error.status = 400;
    throw error;
  }
  return number;
};

const findById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return Announcement.findById(id);
};

const readOptionalUserId = (req) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    return decoded?.id || null;
  } catch (_err) {
    return null;
  }
};

exports.seedFirstAnnouncement = async () => {
  try {
    const existing = await Announcement.findOne({ seedKey: SEED_KEY });
    if (existing) return existing;
    const created = await Announcement.create({
      seedKey: SEED_KEY,
      title: SEED_TITLE,
      body: SEED_BODY,
      whatsappNumber: '',
      status: 'draft',
    });
    console.log('Annonce brouillon créée : répertoire de cantiques');
    return created;
  } catch (error) {
    if (error?.code === 11000) return Announcement.findOne({ seedKey: SEED_KEY });
    console.error('Erreur lors de la création de l’annonce brouillon', error);
    return null;
  }
};

exports.active = async (req, res, next) => {
  try {
    await syncSchedules();
    const doc = await Announcement.findOne({ status: 'active' }).sort({ launchedAt: -1 });
    if (!doc) return res.json({ announcement: null, dismissed: false });

    let dismissed = false;
    const userId = readOptionalUserId(req);
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      const user = await User.findById(userId).select('dismissedAnnouncements');
      dismissed = Boolean(user?.dismissedAnnouncements?.some((id) => String(id) === String(doc._id)));
    }

    return res.json({ announcement: presentPublic(doc), dismissed });
  } catch (err) {
    return next(err);
  }
};

exports.list = async (_req, res, next) => {
  try {
    await syncSchedules();
    const docs = await Announcement.find().sort({ updatedAt: -1 });
    docs.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
    return res.json({ announcements: docs.map(presentAdmin) });
  } catch (err) {
    return next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const title = readText(req.body?.title, 200, 'Le titre');
    const body = readText(req.body?.body, 5000, 'Le texte');
    const whatsappNumber = readNumber(req.body?.whatsappNumber);
    const doc = await Announcement.create({
      title,
      body,
      whatsappNumber,
      status: 'draft',
    });
    return res.status(201).json({ announcement: presentAdmin(doc) });
  } catch (err) {
    return next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const doc = await findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Annonce introuvable' });

    const title = readText(req.body?.title, 200, 'Le titre');
    const body = readText(req.body?.body, 5000, 'Le texte');
    const whatsappNumber = readNumber(req.body?.whatsappNumber, { required: doc.status === 'active' });

    doc.title = title;
    doc.body = body;
    doc.whatsappNumber = whatsappNumber;
    if (hasScheduleFields(req.body)) {
      const schedule = readSchedule(req.body);
      doc.startsAt = schedule.startsAt;
      doc.endsAt = schedule.endsAt;
      doc.timezone = schedule.timezone;
      if (doc.status === 'scheduled' && !schedule.startsAt) doc.status = 'draft';
    }
    await doc.save();
    return res.json({ announcement: presentAdmin(doc) });
  } catch (err) {
    return next(err);
  }
};

exports.launch = async (req, res, next) => {
  try {
    const doc = await findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Annonce introuvable' });
    if (!doc.title.trim() || !doc.body.trim()) {
      return res.status(400).json({ message: 'Le titre et le texte sont requis pour lancer l’annonce' });
    }
    if (!isInternationalWhatsappNumber(doc.whatsappNumber)) {
      return res.status(400).json({ message: 'Indiquez un numéro WhatsApp au format international avant de lancer' });
    }
    if (doc.status === 'active') return res.json({ announcement: presentAdmin(doc) });

    await Announcement.updateMany(
      { _id: { $ne: doc._id }, status: 'active' },
      { $set: { status: 'stopped', stoppedAt: new Date() }, $unset: { activeSlot: 1 } },
    );

    await Announcement.updateOne(
      { _id: doc._id },
      {
        $set: { status: 'active', activeSlot: 'live', launchedAt: new Date() },
        $unset: { stoppedAt: 1 },
      },
    );
    const fresh = await Announcement.findById(doc._id);
    return res.json({ announcement: presentAdmin(fresh) });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Une autre annonce est déjà en cours' });
    }
    return next(err);
  }
};

exports.schedule = async (req, res, next) => {
  try {
    const doc = await findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Annonce introuvable' });
    if (doc.status === 'active') {
      return res.status(400).json({ message: 'Arrêtez l’annonce avant de la programmer' });
    }
    if (!doc.title.trim() || !doc.body.trim()) {
      return res.status(400).json({ message: 'Le titre et le texte sont requis pour programmer l’annonce' });
    }
    if (!isInternationalWhatsappNumber(doc.whatsappNumber)) {
      return res.status(400).json({ message: 'Indiquez un numéro WhatsApp au format international avant de programmer' });
    }
    if (!doc.startsAt || !isValidTimeZone(doc.timezone)) {
      return res.status(400).json({ message: 'Indiquez un début et un fuseau horaire' });
    }
    if (doc.startsAt.getTime() <= Date.now()) {
      return res.status(400).json({ message: 'La date de début doit être dans le futur. Pour une diffusion immédiate, utilisez Lancer.' });
    }
    if (doc.endsAt && doc.endsAt.getTime() <= doc.startsAt.getTime()) {
      return res.status(400).json({ message: 'La fin doit être après le début.' });
    }

    await Announcement.updateOne(
      { _id: doc._id },
      { $set: { status: 'scheduled' }, $unset: { activeSlot: 1, stoppedAt: 1 } },
    );
    const fresh = await Announcement.findById(doc._id);
    return res.json({ announcement: presentAdmin(fresh) });
  } catch (err) {
    return next(err);
  }
};

exports.stop = async (req, res, next) => {
  try {
    const doc = await findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Annonce introuvable' });
    if (doc.status !== 'active' && doc.status !== 'scheduled') {
      return res.json({ announcement: presentAdmin(doc) });
    }

    await Announcement.updateOne(
      { _id: doc._id },
      { $set: { status: 'stopped', stoppedAt: new Date() }, $unset: { activeSlot: 1 } },
    );
    const fresh = await Announcement.findById(doc._id);
    return res.json({ announcement: presentAdmin(fresh) });
  } catch (err) {
    return next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const doc = await findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Annonce introuvable' });
    if (doc.seedKey === SEED_KEY) {
      return res.status(400).json({ message: 'Le brouillon d’origine ne peut pas être supprimé' });
    }
    if (doc.status === 'active') {
      return res.status(400).json({ message: 'Arrêtez l’annonce avant de la supprimer' });
    }
    await doc.deleteOne();
    return res.json({ deleted: true, id: String(doc._id) });
  } catch (err) {
    return next(err);
  }
};

exports.dismiss = async (req, res, next) => {
  try {
    const doc = await findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Annonce introuvable' });
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'No token provided' });

    const updated = await User.updateOne(
      { _id: userId },
      { $addToSet: { dismissedAnnouncements: doc._id } },
    );
    if (!updated.matchedCount) return res.status(401).json({ message: 'Session invalide' });
    return res.json({ dismissed: true, id: String(doc._id) });
  } catch (err) {
    return next(err);
  }
};
