const { MongoClient } = require("mongodb");

let db;

async function connectMongo() {
  try {
    const client = new MongoClient(process.env.MONGO_URL);
    await client.connect();
    db = client.db(); // default: "mydb"
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB error:", err);
  }
}

module.exports = connectMongo;
