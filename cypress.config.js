const path = require("path");

// Frappe's test runner installs Cypress in the sibling frappe app. Exporting a plain
// object avoids requiring a package that is intentionally not a dependency of this app.
module.exports = {
  adminPassword: "admin",
  defaultCommandTimeout: 20000,
  pageLoadTimeout: 60000,
  video: true,
  videosFolder: path.resolve(__dirname, "..", "..") + "/cypressVideos/",
  viewportHeight: 960,
  viewportWidth: 1400,
  retries: { runMode: 1, openMode: 0 },
  e2e: {
    baseUrl: "http://ci.test:8000",
    specPattern: ["**/ui_test_*.js"],
    supportFile: "cypress/support/e2e.js",
    testIsolation: false,
  },
};
