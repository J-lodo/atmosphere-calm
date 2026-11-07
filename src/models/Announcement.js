const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema({
  seedKey: { type: String },
  title: { type: String, default: '', maxlength: 200 },
  body: { type: String, default: '', maxlength: 5000 },
  whatsappNumber: { type: String, default: '', maxlength: 32 },
  status: {
    type: String,
    enum: ['draft', 'active', 'stopped'],
    default: 'draft',
  },
  // Une seule valeur « live » à la fois : index unique partiel.
  activeSlot: { type: String },
  launchedAt: { type: Date },
  stoppedAt: { type: Date },
}, { timestamps: true });

AnnouncementSchema.index(
  { activeSlot: 1 },
  { unique: true, partialFilterExpression: { activeSlot: 'live' } },
);
AnnouncementSchema.index(
  { seedKey: 1 },
  { unique: true, partialFilterExpression: { seedKey: { $type: 'string' } } },
);

module.exports = mongoose.model('Announcement', AnnouncementSchema);
