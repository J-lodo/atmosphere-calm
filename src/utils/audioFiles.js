const path = require('path');
const fs = require('fs');

const AUDIO_URL_PREFIX = '/api/uploads/audio/';

function getAudioFilePath(audioUrl) {
  if (!audioUrl || typeof audioUrl !== 'string') return null;
  if (!audioUrl.startsWith(AUDIO_URL_PREFIX)) return null;
  const fileName = path.basename(audioUrl);
  return path.join(__dirname, '../../uploads/audio', fileName);
}

function deleteAudioFile(audioUrl) {
  const filePath = getAudioFilePath(audioUrl);
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('Impossible de supprimer le fichier audio', err);
  }
}

module.exports = {
  AUDIO_URL_PREFIX,
  getAudioFilePath,
  deleteAudioFile,
};
