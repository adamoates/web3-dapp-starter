#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const FORBIDDEN_PATTERNS = [
  "coverage/",
  "allure-results/",
  "allure-report/",
  "node_modules/",
  "*.log",
  "*.tmp",
  "*.temp",
  "jest.temp.config.js"
];

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getStagedFiles() {
  try {
    const output = execSync("git diff --cached --name-only", {
      encoding: "utf8"
    });
    return output
      .trim()
      .split("\n")
      .filter((file) => file.length > 0);
  } catch (error) {
    return [];
  }
}

function checkFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

function checkForbiddenPatterns(filePath) {
  return FORBIDDEN_PATTERNS.some((pattern) => {
    if (pattern.includes("*")) {
      const regex = new RegExp(pattern.replace("*", ".*"));
      return regex.test(filePath);
    }
    return filePath.includes(pattern);
  });
}

console.log("🔍 Running pre-commit checks...\n");

const stagedFiles = getStagedFiles();
let hasErrors = false;

if (stagedFiles.length === 0) {
  console.log("✅ No files staged for commit");
  process.exit(0);
}

console.log(`📋 Checking ${stagedFiles.length} staged files...\n`);

stagedFiles.forEach((file) => {
  const filePath = path.resolve(file);

  // Check for forbidden patterns
  if (checkForbiddenPatterns(file)) {
    console.log(`❌ Forbidden file: ${file}`);
    console.log(`   This file should not be committed. Add it to .gitignore`);
    hasErrors = true;
  }

  // Check file size
  const fileSize = checkFileSize(filePath);
  if (fileSize > MAX_FILE_SIZE) {
    console.log(`❌ Large file: ${file} (${formatBytes(fileSize)})`);
    console.log(`   Consider using Git LFS or adding to .gitignore`);
    hasErrors = true;
  }
});

if (hasErrors) {
  console.log("\n🚫 Pre-commit checks failed!");
  console.log("Please fix the issues above before committing.");
  process.exit(1);
} else {
  console.log("✅ All pre-commit checks passed!");
  process.exit(0);
}
