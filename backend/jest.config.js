module.exports = {
  testEnvironment: "node",
  testPathIgnorePatterns: ["/node_modules/"],
  collectCoverageFrom: ["src/**/*.js", "!**/node_modules/**"],
  coverageReporters: ["text", "lcov", "html"],
  testMatch: ["**/test/**/*.test.js"],
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  testTimeout: 10000,

  // Projects for different test environments
  projects: [
    {
      displayName: "unit",
      testMatch: ["<rootDir>/test/unit/**/*.test.js"],
      setupFilesAfterEnv: ["<rootDir>/test/setup/mock.js"],
      testEnvironment: "node",
      clearMocks: true,
      resetMocks: true,
      restoreMocks: true,
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1"
      }
    },
    {
      displayName: "mock-integration",
      testMatch: ["<rootDir>/test/mock-integration/**/*.test.js"],
      setupFilesAfterEnv: ["<rootDir>/test/setup/mock-integration.js"],
      testEnvironment: "node",
      clearMocks: true,
      resetMocks: true,
      restoreMocks: true
    },
    {
      displayName: "integration",
      testMatch: ["<rootDir>/test/integration/**/*.test.js"],
      setupFilesAfterEnv: ["<rootDir>/test/setup/real.js"],
      testEnvironment: "node",
      testTimeout: 45000,
      clearMocks: false,
      resetMocks: false,
      restoreMocks: false
    },
    {
      displayName: "docker-integration",
      testMatch: ["<rootDir>/test/integration/docker-*.test.js"],
      setupFilesAfterEnv: ["<rootDir>/test/setup/docker.js"],
      testEnvironment: "node",
      testTimeout: 120000, // 2 minutes for Docker setup
      clearMocks: false,
      resetMocks: false,
      restoreMocks: false
    },
    {
      displayName: "security",
      testMatch: ["<rootDir>/test/security/**/*.test.js"],
      setupFilesAfterEnv: ["<rootDir>/test/setup/mock.js"],
      testEnvironment: "node"
    },
    {
      displayName: "performance",
      testMatch: ["<rootDir>/test/performance/**/*.test.js"],
      setupFilesAfterEnv: ["<rootDir>/test/setup/mock.js"],
      testEnvironment: "node"
    }
  ],
  transform: {
    "^.+\\.jsx?$": "babel-jest"
  }
};
