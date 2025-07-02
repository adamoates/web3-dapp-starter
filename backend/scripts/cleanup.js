#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("🧹 Cleaning up generated files...");

const directoriesToClean = [
  "coverage",
  "allure-results",
  "allure-report",
  ".cache",
  ".temp"
];

const filesToClean = ["jest.temp.config.js", "*.log", "*.tmp", "*.temp"];

function removeDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    console.log(`  Removing directory: ${dirPath}`);
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

function removeFiles(pattern) {
  try {
    execSync(
      `find . -name "${pattern}" -type f -not -path "./node_modules/*" -delete`,
      { stdio: "pipe" }
    );
    console.log(`  Removed files matching: ${pattern}`);
  } catch (error) {
    // No files found or other error, which is fine
  }
}

// Clean directories
directoriesToClean.forEach((dir) => {
  removeDirectory(dir);
});

// Clean files
filesToClean.forEach((pattern) => {
  removeFiles(pattern);
});

// Clean node_modules if requested
if (process.argv.includes("--deep")) {
  console.log("  Removing node_modules...");
  removeDirectory("node_modules");
  console.log('  Run "npm install" to reinstall dependencies');
}

console.log("✅ Cleanup complete!");
console.log("");
console.log("To regenerate files:");
console.log("  npm test -- --coverage    # Generate coverage reports");
console.log("  npm run test:allure       # Generate Allure reports");
console.log(
  "  npm install               # Reinstall dependencies (if --deep was used)"
);
