const Cantique = require('../models/Cantique');
const Langue = require('../models/Langue');
const { deleteAudioFile } = require('../utils/audioFiles');

function normalizeLangue(name) {
  if (typeof name !== 'string') return '';
  return name.trim();
}

async function ensureLangueExists(name) {
  const normalized = normalizeLangue(name);
  if (!normalized) return;
  try {
    // upsert to keep Langue list in sync with any cantique writes
    await Langue.findOneAndUpdate(
      { name: normalized },
      { name: normalized },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (e) {
    // ignore duplicate races (unique index)
    if (!(e && e.code === 11000)) throw e;
  }
}

async function computeNextNumber() {
  const last = await Cantique.findOne({ number: { $ne: null } }).sort('-number').lean();
  const currentMax = typeof last?.number === 'number' ? last.number : 0;
  return currentMax + 1;
}

function sanitizeCouplets(rawCouplets) {
  if (!Array.isArray(rawCouplets)) return [];
  return rawCouplets
    .filter(Boolean)
    .map((c, idx) => {
      const text = typeof c.text === 'string' ? c.text : '';
      const n = c.numero ?? c.number ?? c.num ?? idx + 1;
      const numero = Number.isFinite(Number(n)) ? Number(n) : idx + 1;
      return { numero, text };
    });
}

function sanitizeRefrain(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') return { text: raw };
  const text = typeof raw.text === 'string' ? raw.text : '';
  return text ? { text } : null;
}

function sanitizeAudioFields(body = {}) {
  const payload = {};
  const explicitRemoval = body.audioUrl === null || body.audioUrl === '';
  const hasAudio = explicitRemoval ? false : Boolean(body.hasAudio || body.audio || body.audioUrl);
  payload.hasAudio = hasAudio;
  payload.audio = hasAudio;

  if (typeof body.audioUrl === 'string' && body.audioUrl.trim()) {
    payload.audioUrl = body.audioUrl.trim();
    payload.hasAudio = true;
    payload.audio = true;
  } else if (explicitRemoval) {
    payload.audioUrl = null;
    payload.audioFileName = null;
    payload.audioMimeType = null;
    payload.hasAudio = false;
    payload.audio = false;
  }

  if (typeof body.audioFileName === 'string') {
    payload.audioFileName = body.audioFileName.trim();
  }

  if (typeof body.audioMimeType === 'string') {
    payload.audioMimeType = body.audioMimeType.trim();
  }

  return payload;
}

exports.uploadAudio = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier audio fourni' });
    }

    const audioUrl = `/api/uploads/audio/${req.file.filename}`;
    res.status(201).json({
      hasAudio: true,
      audio: true,
      audioUrl,
      audioFileName: req.file.originalname,
      audioMimeType: req.file.mimetype,
    });
  } catch (err) {
    next(err);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    // Ensure all cantiques have a persistent `number` assigned.
    // Fetch in created order so numbering follows first-come, first-served.
    let list = await Cantique.find().sort('createdAt');

    // Identify documents missing a numeric `number` field
    const missing = list.filter(c => typeof c.number !== 'number');
    if (missing.length > 0) {
      // Find current max number to continue sequence without collision
      const last = await Cantique.findOne({ number: { $ne: null } }).sort('-number').lean();
      let next = typeof last?.number === 'number' ? last.number + 1 : 1;

      // Assign numbers to missing documents in createdAt order
      for (const doc of missing) {
        // update the document with the next number
        await Cantique.findByIdAndUpdate(doc._id, { number: next });
        next += 1;
      }

      // Reload the list with numbers now present
      list = await Cantique.find().sort('createdAt');
    }

    res.json(list);
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const cantique = await Cantique.findById(req.params.id);
    if (!cantique) return res.status(404).json({ message: 'Not found' });
    res.json(cantique);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const langue = normalizeLangue(req.body?.langue);
    if (!langue) return res.status(400).json({ message: 'langue is required' });

    const payload = {
      title: req.body?.title,
      langue,
      couplets: sanitizeCouplets(req.body?.couplets),
      refrain: sanitizeRefrain(req.body?.refrain),
      ...sanitizeAudioFields(req.body),
    };

    // numéro de cantique : 1,2,3... premier arrivé, premier servi.
    // si un numéro est fourni explicitement on le respecte, sinon on calcule le suivant.
    if (typeof req.body?.number === 'number') {
      payload.number = req.body.number;
    } else {
      payload.number = await computeNextNumber();
    }

    const obj = new Cantique(payload);
    const saved = await obj.save();
    await ensureLangueExists(saved.langue);
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const langue = req.body?.langue ? normalizeLangue(req.body.langue) : undefined;
    const updatePayload = {};
    if (typeof req.body?.title === 'string') updatePayload.title = req.body.title;
    if (langue !== undefined) updatePayload.langue = langue;
    if (req.body?.couplets !== undefined) updatePayload.couplets = sanitizeCouplets(req.body.couplets);
    if (req.body?.refrain !== undefined) updatePayload.refrain = sanitizeRefrain(req.body.refrain);
    if (
      req.body?.audioUrl !== undefined ||
      req.body?.audioFileName !== undefined ||
      req.body?.audioMimeType !== undefined ||
      req.body?.hasAudio !== undefined ||
      req.body?.audio !== undefined
    ) {
      Object.assign(updatePayload, sanitizeAudioFields(req.body));
    }

    const existing = await Cantique.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Not found' });

    const updated = await Cantique.findByIdAndUpdate(req.params.id, updatePayload, { new: true });
    const nextAudioUrl = updatePayload.audioUrl !== undefined ? updatePayload.audioUrl : existing.audioUrl;
    if (existing.audioUrl && existing.audioUrl !== nextAudioUrl) {
      deleteAudioFile(existing.audioUrl);
    }

    await ensureLangueExists(updated.langue);
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const removed = await Cantique.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ message: 'Not found' });
    if (removed.audioUrl) {
      deleteAudioFile(removed.audioUrl);
    }
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};