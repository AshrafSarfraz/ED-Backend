const mongoose = require('mongoose');

const El_Distributor = mongoose.createConnection(process.env.MONGO_URI, {});
const Inventory = El_Distributor.useDb( process.env.DB_INVENTORY || 'InventoryRecords',{ useCache: true });


El_Distributor.on('connected', () => console.log('✅ MongoDB connected: El_Distributor'));
El_Distributor.on('error', (err) => console.error('❌ MongoDB connection error:', err));

module.exports = { El_Distributor, Inventory };