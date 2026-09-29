const express = require('express');
const rateLimit = require('express-rate-limit');
const visitorController = require('../controllers/visitorController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const heartbeatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes.' },
});

router.post('/heartbeat', heartbeatLimiter, visitorController.heartbeat);
router.get('/', authMiddleware, visitorController.list);
router.get('/ip-check', authMiddleware, visitorController.ipCheck);

module.exports = router;
