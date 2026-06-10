const path = require('path');
const dotenv = require('dotenv');

// Load backend .env explicitly
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../src/config/db');
const mongoose = require('mongoose');
const Cantique = require('../src/models/Cantique');

async function main() {
  try {
    await connectDB();
    const latest = await Cantique.findOne().sort({ createdAt: -1 }).lean();
    if (!latest) {
      console.log('No cantiques found');
      return process.exit(0);
    }

    console.log('--- Latest cantique ---');
    console.log(`id: ${latest._id}`);
    console.log(`number: ${latest.number}`);
    console.log(`title: ${latest.title}`);
    console.log(`langue: ${latest.langue}`);
    console.log(`hasAudio: ${Boolean(latest.hasAudio)}`);
    if (latest.audioUrl) {
      console.log(`audioUrl: ${latest.audioUrl}`);
    }
    console.log('Full document:');
    console.log(JSON.stringify(latest, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error fetching latest cantique:', err.message || err);
    process.exit(2);
  }
}

main();
