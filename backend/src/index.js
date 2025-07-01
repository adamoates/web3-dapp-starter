require("dotenv").config();
const app = require("./app");
const DatabaseManager = require("./db/DatabaseManager");

// Initialize database manager
const dbManager = new DatabaseManager();

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully...");
  try {
    await dbManager.disconnect();
    console.log("✅ Databases disconnected");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
});

process.on("SIGINT", async () => {
  console.log("🛑 Received SIGINT, shutting down gracefully...");
  try {
    await dbManager.disconnect();
    console.log("✅ Databases disconnected");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
});

// Start server function
async function startServer() {
  try {
    // Connect to all databases
    await dbManager.connect();

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log("📊 Multi-database architecture initialized:");
      console.log("   • PostgreSQL: Structured data & transactions");
      console.log("   • MongoDB: Blockchain events & NFT metadata");
      console.log("   • Redis: Caching & session management");
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      console.log(`📈 Database info: http://localhost:${PORT}/db-info`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Start server if not in test mode
if (process.env.NODE_ENV !== "test") {
  startServer();
}

module.exports = { app, dbManager };
