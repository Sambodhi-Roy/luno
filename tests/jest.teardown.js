const { execSync } = require("child_process");
const path = require("path");

// The suite writes to the shared dev database, so remove what it created once every test file has run.
// Set KEEP_TEST_DATA=1 to keep it for debugging (then run `pnpm --filter @repo/db cleanup-test-data --yes`).
module.exports = async () => {
  if (process.env.KEEP_TEST_DATA === "1") {
    console.log("\nKEEP_TEST_DATA=1: leaving test data in the database");
    return;
  }
  execSync("pnpm --silent --filter @repo/db cleanup-test-data --yes", {
    cwd: path.resolve(__dirname, "../core"),
    stdio: "inherit",
  });
};
