const path = require('path');
const fs = require('fs');

const AUDIO_URL_PREFIX = '/api/uploads/audio/';

function getAudioFilePath(audioUrl) {
  if (!audioUrl || typeof audioUrl !== 'string') return null;
  if (!audioUrl.startsWith(AUDIO_URL_PREFIX)) return null;
  const fileName = path.basename(audioUrl);
  return path.join(__dirname, '../../uploads/audio', fileName);
}

function parseCloudinaryPublicId(url) {
  // Example Cloudinary URL: https://res.cloudinary.com/<cloud>/raw/upload/v1234567890/folder/name.ext
  try {
    const u = new URL(url);
    const idx = u.pathname.indexOf('/upload/');
    if (idx === -1) return null;
    let after = u.pathname.slice(idx + '/upload/'.length);
    // remove version prefix if present (v123.../)
    after = after.replace(/^v\d+\//, '');
    // remove extension
    const withoutExt = after.replace(/\.[^/.]+$/, '');
    return withoutExt;
  } catch (e) {
    return null;
  }
}

async function deleteAudioFile(audioUrl) {
  const localPath = getAudioFilePath(audioUrl);
  if (localPath) {
    try {
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
    } catch (err) {
      console.error('Impossible de supprimer le fichier audio local', err);
    }
    return;
  }

  // attempt remote Cloudinary deletion if URL looks external
  if (typeof audioUrl === 'string' && audioUrl.startsWith('http')) {
    const CLOUD_ENABLED = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
    if (!CLOUD_ENABLED) return;
    try {
      const cloudinary = require('cloudinary').v2;
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });

      const publicId = parseCloudinaryPublicId(audioUrl);
      if (!publicId) return;
      await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    } catch (err) {
      console.error('Impossible de supprimer le fichier audio distant', err);
    }
  }
}

module.exports = {
  AUDIO_URL_PREFIX,
  getAudioFilePath,
  deleteAudioFile,
};
