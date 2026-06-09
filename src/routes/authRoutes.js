const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { isProduction } = require('../config/env');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives de connexion. Réessayez plus tard.' },
});

const blockPublicRegister = (req, res, next) => {
  if (isProduction && process.env.ALLOW_PUBLIC_REGISTER !== 'true') {
    return res.status(403).json({ message: 'Inscription désactivée' });
  }
  return next();
};

router.post('/register', blockPublicRegister, authController.register);
router.post('/login', loginLimiter, authController.login);

module.exports = router;
