const express = require('express');
const router = express.Router();
const langueController = require('../controllers/langueController');
const authMiddleware = require('../middleware/auth');

router.get('/', langueController.getAll);
router.post('/', authMiddleware, langueController.create);
router.put('/:id', authMiddleware, langueController.update);
router.delete('/:id', authMiddleware, langueController.remove);

module.exports = router;