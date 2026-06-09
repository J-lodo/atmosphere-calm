const express = require('express');
const router = express.Router();
const cantiqueController = require('../controllers/cantiqueController');
const authMiddleware = require('../middleware/auth');
const uploadAudio = require('../middleware/uploadAudio');

router.get('/', cantiqueController.getAll);
router.post('/audio', authMiddleware, uploadAudio.single('audio'), cantiqueController.uploadAudio);
router.get('/:id', cantiqueController.getOne);
router.post('/', authMiddleware, cantiqueController.create);
router.put('/:id', authMiddleware, cantiqueController.update);
router.delete('/:id', authMiddleware, cantiqueController.remove);

module.exports = router;