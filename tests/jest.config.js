// const { createDefaultPreset } = require("ts-jest");

// const tsJestTransformCfg = createDefaultPreset().transform;

// /** @type {import("jest").Config} **/
// module.exports = {
//   testEnvironment: "node",
//   transform: {
//     ...tsJestTransformCfg,
//   },
//   include: ["src", "tests"],
// };

/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/*.test.js"],
  // Deletes the users, spaces, avatars, maps and furniture the tests created (see jest.teardown.js)
  globalTeardown: "./jest.teardown.js",
};
