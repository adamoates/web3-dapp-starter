const { Client } = require("pg");

async function connectPostgres() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL
  });

  try {
    await client.connect();
    console.log("✅ PostgreSQL connected");

    // Optional: test query
    const res = await client.query("SELECT NOW()");
    console.log("🕓 Server time:", res.rows[0].now);
  } catch (err) {
    console.error("❌ PostgreSQL error:", err);
  }
}

module.exports = connectPostgres;
