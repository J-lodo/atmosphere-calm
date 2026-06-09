const path = require('path');
const fs = require('fs');
const multer = require('multer');

const uploadDir = path.join(__dirname, '../../uploads/audio');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.webm';
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isAudioMime = file.mimetype?.startsWith('audio/');
    const isAudioExt = /\.(mp3|wav|webm|ogg|m4a|aac|flac|mp4|mpeg)$/i.test(file.originalname || '');
    if (isAudioMime || isAudioExt) {
      cb(null, true);
      return;
    }
    cb(new Error('Format audio non supporté'));
  },
});

module.exports = upload;
