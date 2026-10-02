const Cantique = require('../models/Cantique');

// Numbering is global (all languages share one sequence). Current order is kept:
// by number, then creation date; cantiques without a number go last.
async function planRenumber() {
  const list = await Cantique.find({}, { title: 1, langue: 1, number: 1, createdAt: 1 }).lean();
  list.sort((a, b) => {
    const an = typeof a.number === 'number' ? a.number : Infinity;
    const bn = typeof b.number === 'number' ? b.number : Infinity;
    if (an !== bn) return an - bn;
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
  });
  const changes = [];
  list.forEach((c, index) => {
    const to = index + 1;
    if (c.number !== to) {
      changes.push({
        id: String(c._id), title: c.title, langue: c.langue, from: c.number ?? null, to,
      });
    }
  });
  return { total: list.length, changes };
}

async function applyRenumber() {
  const plan = await planRenumber();
  if (plan.changes.length) {
    await Cantique.bulkWrite(plan.changes.map((c) => ({
      updateOne: { filter: { _id: c.id }, update: { $set: { number: c.to } } },
    })));
  }
  return plan;
}

// After a deletion: close the gap left by `number`, unless another cantique still uses it.
async function closeGap(number) {
  if (typeof number !== 'number') return 0;
  if (await Cantique.exists({ number })) return 0;
  const { modifiedCount } = await Cantique.updateMany({ number: { $gt: number } }, { $inc: { number: -1 } });
  return modifiedCount;
}

module.exports = { planRenumber, applyRenumber, closeGap };
