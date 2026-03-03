const Langue = require('../models/Langue');
const Cantique = require('../models/Cantique');

function normalizeName(name) {
  if (typeof name !== 'string') return '';
  return name.trim();
}

exports.getAll = async (req, res, next) => {
  try {
    const list = await Langue.find().sort('name');
    res.json(list);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const name = normalizeName(req.body?.name);
    if (!name) return res.status(400).json({ message: 'Name is required' });

    const obj = new Langue({ name });
    const saved = await obj.save();
    res.status(201).json(saved);
  } catch (err) {
    // handle unique index violation nicely
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'Language already exists' });
    }
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const existing = await Langue.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Not found' });

    const nextName = normalizeName(req.body?.name);
    if (!nextName) return res.status(400).json({ message: 'Name is required' });

    // if name changes, cascade update to cantiques so UI stays consistent
    const oldName = existing.name;
    if (oldName !== nextName) {
      const duplicate = await Langue.findOne({ name: nextName });
      if (duplicate) return res.status(409).json({ message: 'Language already exists' });
    }

    existing.name = nextName;
    const updated = await existing.save();

    if (oldName !== nextName) {
      await Cantique.updateMany({ langue: oldName }, { $set: { langue: nextName } });
    }

    res.json(updated);
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'Language already exists' });
    }
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const lang = await Langue.findById(req.params.id);
    if (!lang) return res.status(404).json({ message: 'Not found' });

    // prevent deleting a language still referenced by cantiques;
    // otherwise it disappears from dropdown/filter while cantiques still use it.
    const usedCount = await Cantique.countDocuments({ langue: lang.name });
    if (usedCount > 0) {
      return res.status(400).json({
        message: `Cannot delete language "${lang.name}" because it is used by ${usedCount} cantique(s).`,
      });
    }

    await Langue.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};