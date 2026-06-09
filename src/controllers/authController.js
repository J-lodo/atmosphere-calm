const User = require('../models/User');
const jwt = require('jsonwebtoken');

exports.register = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username?.trim() || !password?.trim()) {
      return res.status(400).json({ message: 'Identifiants requis' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caractères' });
    }
    const user = new User({ username: username.trim(), password });
    await user.save();
    res.status(201).json({ message: 'Compte créé' });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Cet utilisateur existe déjà' });
    }
    return next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username?.trim() || !password) {
      return res.status(400).json({ message: 'Identifiants requis' });
    }
    const user = await User.findOne({ username: username.trim() });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Identifiants invalides' });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token });
  } catch (err) {
    next(err);
  }
};