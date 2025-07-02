const fs = require("fs");
const path = require("path");

// Get Node.js version
const nodeVersion = process.version;
// Get DB_STATE from env or default to 'mock'
const dbState = process.env.DB_STATE || "mock";
// Add more dynamic values as needed
const gitBranch = process.env.GIT_BRANCH || "";
const customEnv = process.env.CUSTOM_ENV || "";

const content = [
  `NODE_VERSION=${nodeVersion}`,
  `DB_STATE=${dbState}`,
  gitBranch ? `GIT_BRANCH=${gitBranch}` : "",
  customEnv ? `CUSTOM_ENV=${customEnv}` : ""
]
  .filter(Boolean)
  .join("\n");

const allureResultsDir = path.join(__dirname, "../allure-results");
if (!fs.existsSync(allureResultsDir)) {
  fs.mkdirSync(allureResultsDir, { recursive: true });
}

fs.writeFileSync(
  path.join(allureResultsDir, "environment.properties"),
  content
);
console.log("Allure environment.properties generated:");
console.log(content);
