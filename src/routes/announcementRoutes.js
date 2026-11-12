const express = require('express');
const rateLimit = require('express-rate-limit');
const announcementController = require('../controllers/announcementController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Une assemblée ouvre souvent l’application derrière la même adresse IP,
// et chaque téléphone redemande l’annonce en cours. Le plafond reste haut.
const activeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes.' },
});

const dismissLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes.' },
});

router.get('/active', activeLimiter, announcementController.active);
router.post('/:id/dismiss', dismissLimiter, authMiddleware, announcementController.dismiss);
router.get('/', authMiddleware, announcementController.list);
router.post('/', authMiddleware, announcementController.create);
router.put('/:id', authMiddleware, announcementController.update);
router.post('/:id/lancer', authMiddleware, announcementController.launch);
router.post('/:id/programmer', authMiddleware, announcementController.schedule);
router.post('/:id/arreter', authMiddleware, announcementController.stop);
router.delete('/:id', authMiddleware, announcementController.remove);

module.exports = router;
