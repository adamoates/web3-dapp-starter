#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const MAX_DIR_SIZE = 10 * 1024 * 1024; // 10MB

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

function getDirectorySize(dirPath) {
  let totalSize = 0;

  try {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);

      if (stats.isDirectory()) {
        totalSize += getDirectorySize(itemPath);
      } else {
        totalSize += stats.size;
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
  }

  return totalSize;
}

function checkFiles(
  directory,
  excludeDirs = ["node_modules", "coverage", "allure-results", "allure-report"]
) {
  const largeFiles = [];
  const largeDirs = [];

  function scanDirectory(dir, relativePath = "") {
    try {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const itemPath = path.join(dir, item);
        const relativeItemPath = path.join(relativePath, item);

        // Skip excluded directories
        if (excludeDirs.some((exclude) => relativeItemPath.includes(exclude))) {
          continue;
        }

        const stats = fs.statSync(itemPath);

        if (stats.isDirectory()) {
          const dirSize = getDirectorySize(itemPath);
          if (dirSize > MAX_DIR_SIZE) {
            largeDirs.push({
              path: relativeItemPath,
              size: dirSize,
              formatted: formatBytes(dirSize)
            });
          }
          scanDirectory(itemPath, relativeItemPath);
        } else {
          if (stats.size > MAX_FILE_SIZE) {
            largeFiles.push({
              path: relativeItemPath,
              size: stats.size,
              formatted: formatBytes(stats.size)
            });
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
  }

  scanDirectory(directory);

  return { largeFiles, largeDirs };
}

console.log("📊 Checking file sizes...\n");

const { largeFiles, largeDirs } = checkFiles(".");

if (largeFiles.length === 0 && largeDirs.length === 0) {
  console.log("✅ No large files or directories found!");
} else {
  if (largeFiles.length > 0) {
    console.log("⚠️  Large files found (>1MB):");
    largeFiles
      .sort((a, b) => b.size - a.size)
      .forEach((file) => {
        console.log(`  ${file.path} - ${file.formatted}`);
      });
    console.log("");
  }

  if (largeDirs.length > 0) {
    console.log("⚠️  Large directories found (>10MB):");
    largeDirs
      .sort((a, b) => b.size - a.size)
      .forEach((dir) => {
        console.log(`  ${dir.path} - ${dir.formatted}`);
      });
    console.log("");
  }

  console.log("💡 Recommendations:");
  console.log("  - Consider adding large files to .gitignore");
  console.log("  - Use .gitattributes for binary files");
  console.log("  - Consider using Git LFS for large files");
  console.log('  - Run "npm run clean" to remove generated files');
}

// Check specific directories
const dirsToCheck = ["coverage", "allure-results", "allure-report"];
console.log("\n📁 Generated directories size:");
dirsToCheck.forEach((dir) => {
  const size = getDirectorySize(dir);
  if (size > 0) {
    console.log(`  ${dir}/ - ${formatBytes(size)}`);
  }
});
