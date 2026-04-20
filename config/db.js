const mongoose = require('mongoose');

/**
 * Connects to MongoDB with retry logic.
 * Logs connection status clearly so ops teams can track issues.
 */
const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('[DB] MONGO_URI is not defined in environment variables.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, {
      // Mongoose 7+ uses these defaults; listed for explicitness
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`[DB] MongoDB connected → ${conn.connection.host}`);
  } catch (err) {
    console.error(`[DB] Connection failed: ${err.message}`);
    process.exit(1);
  }
};

// Graceful disconnect on app shutdown
const disconnectDB = async () => {
  await mongoose.connection.close();
  console.log('[DB] MongoDB connection closed.');
};

module.exports = { connectDB, disconnectDB };