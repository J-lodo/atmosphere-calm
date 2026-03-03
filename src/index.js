require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const cantiqueRoutes = require('./routes/cantiqueRoutes');
const langueRoutes = require('./routes/langueRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
const path = require('path');

// middleware
app.use(cors());
app.use(bodyParser.json());

// Servir les fichiers statiques du frontend
app.use(express.static(path.join(__dirname, '../build')));

// routes API
app.use('/api/auth', authRoutes);
app.use('/api/cantiques', cantiqueRoutes);
app.use('/api/langues', langueRoutes);

// error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

// Catch-all pour les routes SPA React (doit être après les routes API)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../build/index.html'));
});

// database connection
const connectDB = require('./config/db');

const User = require('./models/User');

const seedAdmin = async () => {
  try {
    const existing = await User.findOne({ username: 'admin@aclm.com' });
    if (!existing) {
      const admin = new User({ username: 'admin@aclm.com', password: 'Aclm2026' });
      await admin.save();
      console.log('Admin user seeded: admin@aclm.com');
    }
  } catch (e) {
    console.error('Error seeding admin user', e);
  }
};

connectDB().then(async () => {
  // seed admin account
  await seedAdmin();

  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`Server running on port ${port}`));
}).catch(err => {
  console.error('Failed to connect to DB', err);
});