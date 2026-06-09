require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');

const { isProduction, validateEnv, getAllowedOrigins } = require('./config/env');
const connectDB = require('./config/db');
const cantiqueRoutes = require('./routes/cantiqueRoutes');
const langueRoutes = require('./routes/langueRoutes');
const authRoutes = require('./routes/authRoutes');
const User = require('./models/User');

validateEnv();

const app = express();
const buildPath = path.join(__dirname, '../build');
const uploadsPath = path.join(__dirname, '../uploads');
const hasFrontendBuild = fs.existsSync(path.join(buildPath, 'index.html'));

const allowedOrigins = getAllowedOrigins();
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: allowedOrigins ?? (!isProduction),
  credentials: Boolean(allowedOrigins),
}));
app.use(bodyParser.json({ limit: '2mb' }));

app.use('/api/uploads', express.static(path.join(uploadsPath)));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    frontend: hasFrontendBuild,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/cantiques', cantiqueRoutes);
app.use('/api/langues', langueRoutes);

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'Route API introuvable' });
  }
  return next();
});

if (hasFrontendBuild) {
  app.use(express.static(buildPath, {
    index: false,
    maxAge: isProduction ? '1d' : 0,
  }));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

app.use((err, req, res, _next) => {
  console.error(err);

  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'Fichier audio trop volumineux (max 25 Mo)' });
  }

  if (err?.message === 'Format audio non supporté') {
    return res.status(400).json({ message: err.message });
  }

  const status = err.status || err.statusCode || 500;
  const message = isProduction && status >= 500
    ? 'Erreur interne du serveur'
    : (err.message || 'Erreur interne du serveur');

  res.status(status).json({ message });
});

const seedAdmin = async () => {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    if (isProduction) {
      console.warn('ADMIN_EMAIL / ADMIN_PASSWORD non définis — aucun compte admin initial créé.');
    }
    return;
  }

  try {
    const existing = await User.findOne({ username: email });
    if (!existing) {
      const admin = new User({ username: email, password });
      await admin.save();
      console.log(`Compte admin initial créé : ${email}`);
    }
  } catch (error) {
    console.error('Erreur lors de la création du compte admin', error);
  }
};

connectDB()
  .then(async () => {
    await seedAdmin();

    const port = process.env.PORT || 5000;
    app.listen(port, () => {
      console.log(`Serveur démarré sur le port ${port} (${process.env.NODE_ENV || 'development'})`);
      if (!hasFrontendBuild) {
        console.warn('Build frontend introuvable — API seule. Exécutez : npm run build');
      }
    });
  })
  .catch((error) => {
    console.error('Échec de connexion à la base de données', error);
    process.exit(1);
  });
