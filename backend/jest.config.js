module.exports = {
  // Test environment
  testEnvironment: "node",

  // Setup files
  setupFilesAfterEnv: ["<rootDir>/test/setup/mock.js"],

  // Test patterns
  testMatch: ["<rootDir>/test/**/*.test.js", "<rootDir>/test/**/*.spec.js"],

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/index.js",
    "!src/app.js",
    "!src/database.js",
    "!src/migrations/**",
    "!src/templates/**",
    "!src/utils/minio.js"
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html", "json"],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Projects for different test types
  projects: [
    {
      displayName: "unit",
      testMatch: ["<rootDir>/test/unit/**/*.test.js"],
      setupFilesAfterEnv: ["<rootDir>/test/setup/mock.js"]
    },
    {
      displayName: "integration",
      testMatch: ["<rootDir>/test/integration/**/*.test.js"],
      setupFilesAfterEnv: ["<rootDir>/test/setup/mock.js"]
    },
    {
      displayName: "mock-integration",
      testMatch: ["<rootDir>/test/mock-integration/**/*.test.js"],
      setupFilesAfterEnv: [
        "<rootDir>/test/setup/mock.js",
        "<rootDir>/test/setup/mock-integration.js"
      ]
    }
  ],

  // Module name mapping
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1"
  },

  // Transform configuration
  transform: {},

  // Test timeout
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Coverage exclusions
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/test/",
    "/coverage/",
    "/migrations/",
    "/templates/",
    "jest.config.js",
    "package.json"
  ],

  // Test environment variables
  testEnvironmentOptions: {
    NODE_ENV: "test"
  }
};
