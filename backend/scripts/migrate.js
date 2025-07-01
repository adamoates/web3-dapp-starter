#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

// Database configuration
const config = {
  host: process.env.POSTGRES_HOST || "localhost",
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || "dapp",
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "password"
};

// Test database configuration
const testConfig = {
  host: process.env.POSTGRES_HOST || "localhost",
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB_TEST || "dapp_test",
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "password"
};

async function runMigrations(pool, migrationsDir) {
  console.log("🔍 Scanning for migration files...");

  try {
    // Read migration files
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort(); // Ensure migrations run in order

    console.log(`📁 Found ${migrationFiles.length} migration files`);

    // Create migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get executed migrations
    const { rows: executedMigrations } = await pool.query(
      "SELECT filename FROM migrations ORDER BY id"
    );
    const executedFiles = executedMigrations.map((row) => row.filename);

    // Run pending migrations
    for (const filename of migrationFiles) {
      if (!executedFiles.includes(filename)) {
        console.log(`🚀 Running migration: ${filename}`);

        const filePath = path.join(migrationsDir, filename);
        const sql = fs.readFileSync(filePath, "utf8");

        // Split SQL by semicolons and execute each statement
        const statements = sql
          .split(";")
          .map((stmt) => stmt.trim())
          .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));

        for (const statement of statements) {
          if (statement.trim()) {
            await pool.query(statement);
          }
        }

        // Record migration as executed
        await pool.query("INSERT INTO migrations (filename) VALUES ($1)", [
          filename
        ]);

        console.log(`✅ Migration completed: ${filename}`);
      } else {
        console.log(`⏭️  Skipping already executed migration: ${filename}`);
      }
    }

    console.log("🎉 All migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

async function rollbackMigration(pool, migrationsDir, steps = 1) {
  console.log(`🔄 Rolling back ${steps} migration(s)...`);

  try {
    // Get executed migrations in reverse order
    const { rows: executedMigrations } = await pool.query(
      "SELECT filename FROM migrations ORDER BY id DESC LIMIT $1",
      [steps]
    );

    if (executedMigrations.length === 0) {
      console.log("⚠️  No migrations to rollback");
      return;
    }

    for (const { filename } of executedMigrations) {
      console.log(`🔄 Rolling back: ${filename}`);

      const filePath = path.join(migrationsDir, filename);
      const sql = fs.readFileSync(filePath, "utf8");

      // Extract rollback statements (commented out in migration files)
      const rollbackMatch = sql.match(/-- Down migration.*?$/s);
      if (rollbackMatch) {
        const rollbackSQL = rollbackMatch[0]
          .replace(
            "-- Down migration (commented out - uncomment to rollback)",
            ""
          )
          .replace(/\/\*[\s\S]*?\*\//g, "") // Remove block comments
          .split(";")
          .map((stmt) => stmt.trim())
          .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));

        for (const statement of rollbackSQL) {
          if (statement.trim()) {
            await pool.query(statement);
          }
        }
      }

      // Remove migration record
      await pool.query("DELETE FROM migrations WHERE filename = $1", [
        filename
      ]);

      console.log(`✅ Rollback completed: ${filename}`);
    }

    console.log("🎉 Rollback completed successfully!");
  } catch (error) {
    console.error("❌ Rollback failed:", error);
    throw error;
  }
}

async function showMigrations(pool) {
  console.log("📋 Migration Status:");

  try {
    const { rows: executedMigrations } = await pool.query(
      "SELECT filename, executed_at FROM migrations ORDER BY id"
    );

    if (executedMigrations.length === 0) {
      console.log("No migrations have been executed yet.");
    } else {
      executedMigrations.forEach((migration, index) => {
        console.log(
          `${index + 1}. ${migration.filename} (${migration.executed_at})`
        );
      });
    }
  } catch (error) {
    console.error("❌ Failed to show migrations:", error);
    throw error;
  }
}

async function main() {
  const command = process.argv[2];
  const environment = process.argv[3] || "development";
  const steps = parseInt(process.argv[4]) || 1;

  const config = environment === "test" ? testConfig : config;
  const migrationsDir = path.join(__dirname, "..", "migrations");

  console.log(`🌍 Environment: ${environment}`);
  console.log(`📊 Database: ${config.database}`);

  const pool = new Pool(config);

  try {
    switch (command) {
      case "up":
        await runMigrations(pool, migrationsDir);
        break;
      case "down":
        await rollbackMigration(pool, migrationsDir, steps);
        break;
      case "status":
        await showMigrations(pool);
        break;
      default:
        console.log(`
Usage: node migrate.js <command> [environment] [steps]

Commands:
  up       Run pending migrations
  down     Rollback migrations (default: 1 step)
  status   Show migration status

Environments:
  development  (default)
  test

Examples:
  node migrate.js up
  node migrate.js up test
  node migrate.js down
  node migrate.js down 3
  node migrate.js status
        `);
    }
  } catch (error) {
    console.error("❌ Migration script failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  runMigrations,
  rollbackMigration,
  showMigrations
};
