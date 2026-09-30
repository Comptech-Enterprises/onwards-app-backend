const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://onwardworksapce:57eDU1fFcr0o8zBV@ac-md9izsf-shard-00-00.k8ytzxa.mongodb.net:27017/onward_app?ssl=true&replicaSet=atlas-12iz46-shard-0&authSource=admin&retryWrites=true&w=majority";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "onward_app";

let isConnected = false;

async function connectMongo() {
  if (isConnected) return mongoose.connection;

  try {
    const conn = await mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB_NAME,
      autoIndex: true,
    });
    isConnected = true;
    console.log(`[MONGODB] Connected successfully to MongoDB database: "${MONGODB_DB_NAME}"`);
    return conn;
  } catch (err) {
    console.error("[MONGODB ERROR] Connection failed:", err.message);
    throw err;
  }
}

module.exports = { connectMongo, mongoose, MONGODB_DB_NAME };
