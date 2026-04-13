const mongoose = require('mongoose');

const El_Distributor = mongoose.createConnection(process.env.MONGO_URI, {});

El_Distributor.on('connected', () => console.log('✅ MongoDB connected: El_Distributor'));
El_Distributor.on('error', (err) => console.error('❌ MongoDB connection error:', err));

module.exports = { El_Distributor };