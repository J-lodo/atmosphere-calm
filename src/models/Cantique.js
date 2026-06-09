const mongoose = require('mongoose');

const CantiqueSchema = new mongoose.Schema({
  title: { type: String, required: true },
  langue: { type: String, required: true },
  // numéro logique du cantique (1,2,3,...) distinct de l'_id Mongo
  number: { type: Number, index: true },
  couplets: [
    {
      numero: Number,
      text: String,
    },
  ],
  refrain: {
    text: String,
  },
  hasAudio: { type: Boolean, default: false },
  audio: { type: Boolean, default: false },
  audioUrl: { type: String },
  audioFileName: { type: String },
  audioMimeType: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Cantique', CantiqueSchema);