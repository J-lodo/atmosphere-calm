const express = require('express');
const rateLimit = require('express-rate-limit');
const visitorController = require('../controllers/visitorController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Keyed on req.ip in memory only; the IP is never stored.
const heartbeatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes.' },
});

router.post('/heartbeat', heartbeatLimiter, visitorController.heartbeat);
router.get('/', authMiddleware, visitorController.list);
router.delete('/', authMiddleware, visitorController.removeAll);
router.delete('/:id', authMiddleware, visitorController.remove);

module.exports = router;
