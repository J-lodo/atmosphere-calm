const mongoose = require('mongoose');

const LangueSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
});

module.exports = mongoose.model('Langue', LangueSchema);