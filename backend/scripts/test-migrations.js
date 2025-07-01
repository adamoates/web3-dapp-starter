#!/usr/bin/env node

const path = require("path");
const { Pool } = require("pg");

// Load test environment variables
require("dotenv").config({
  path: path.join(__dirname, "../test.env.docker")
});

// Docker test environment configuration
const DOCKER_CONFIG = {
  postgres: {
    host: "localhost",
    port: 5433,
    user: "test_user",
    password: "test_password",
    database: "test_db"
  }
};

async function runStandaloneMigrations() {
  console.log("🚀 Starting standalone migration test...");

  let postgresPool;

  try {
    // Initialize PostgreSQL connection
    console.log("🔧 Connecting to PostgreSQL...");
    postgresPool = new Pool({
      host: DOCKER_CONFIG.postgres.host,
      port: DOCKER_CONFIG.postgres.port,
      user: DOCKER_CONFIG.postgres.user,
      password: DOCKER_CONFIG.postgres.password,
      database: DOCKER_CONFIG.postgres.database,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });

    // Test connection
    await postgresPool.query("SELECT NOW()");
    console.log("✅ PostgreSQL connected successfully");

    // Reset database
    console.log("🔄 Resetting database...");
    await postgresPool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await postgresPool.query("CREATE SCHEMA public");
    await postgresPool.query("GRANT ALL ON SCHEMA public TO test_user");
    console.log("✅ Database reset complete");

    // Read and execute migration files
    const fs = require("fs");
    const migrationsDir = path.join(__dirname, "../migrations");

    console.log(`📦 Looking for migrations in: ${migrationsDir}`);

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    console.log(
      `📦 Found ${migrationFiles.length} migration files:`,
      migrationFiles
    );

    for (const file of migrationFiles) {
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, "utf8");

      // Extract only the "Up migration" part (before "Down migration")
      const upMigrationMatch = migrationSQL.match(
        /-- Up migration\s*([\s\S]*?)(?=-- Down migration|$)/i
      );
      if (!upMigrationMatch) {
        console.log(`⚠️ No up migration found in ${file}, skipping...`);
        continue;
      }

      const upMigration = upMigrationMatch[1];
      console.log(`\n--- MIGRATION FILE: ${file} ---`);
      console.log(
        "--- UP MIGRATION SQL ---\n" + upMigration + "\n--- END SQL ---"
      );

      try {
        const result = await postgresPool.query(upMigration);
        console.log(`✅ Executed migration: ${file}`);
        if (result && result.command) {
          console.log(`Result: ${result.command}`);
        }
      } catch (error) {
        // Skip errors for IF NOT EXISTS/EXISTS statements
        if (
          error.message.includes("already exists") ||
          error.message.includes("does not exist")
        ) {
          console.log(`ℹ️ Skipped statement in ${file}: ${error.message}`);
        } else {
          console.error(`❌ Error in migration ${file}:`, error.message);
          throw error;
        }
      }
    }

    // Verify tables were created
    console.log("\n🔍 Verifying tables were created...");
    const tablesResult = await postgresPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log(
      "📋 Tables in database:",
      tablesResult.rows.map((row) => row.table_name)
    );

    // Test if users table exists and can be queried
    if (tablesResult.rows.some((row) => row.table_name === "users")) {
      console.log("✅ Users table exists!");
      const usersResult = await postgresPool.query(
        "SELECT COUNT(*) FROM users"
      );
      console.log(`📊 Users table has ${usersResult.rows[0].count} rows`);
    } else {
      console.log("❌ Users table not found!");
    }

    console.log("🎉 Standalone migration test completed successfully!");
  } catch (error) {
    console.error("❌ Standalone migration test failed:", error.message);
    console.error(error.stack);
  } finally {
    if (postgresPool) {
      await postgresPool.end();
      console.log("🔌 PostgreSQL connection closed");
    }
  }
}

// Run the standalone migration test
runStandaloneMigrations().catch(console.error);
