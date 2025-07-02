module.exports = {
  resultsDir: "./allure-results",
  reportDir: "./allure-report",
  reportMode: "failures",
  attachmentsDir: "./allure-results/attachments",
  categories: [
    {
      name: "Failed tests",
      matchedStatuses: ["failed"]
    },
    {
      name: "Broken tests",
      matchedStatuses: ["broken"]
    },
    {
      name: "Ignored tests",
      matchedStatuses: ["skipped"]
    },
    {
      name: "Known issues",
      matchedStatuses: ["failed"],
      messageRegex: ".*known issue.*"
    }
  ]
};
