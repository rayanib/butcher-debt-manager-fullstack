const assert = require("node:assert/strict");
const test = require("node:test");

const { getSessionSecret } = require("../config.js");

test("requires an explicit session secret in production", () => {
  assert.throws(
    () => getSessionSecret({ NODE_ENV: "production" }),
    /SESSION_SECRET is required/
  );
});

test("uses the configured session secret", () => {
  assert.equal(
    getSessionSecret({
      NODE_ENV: "production",
      SESSION_SECRET: "a-production-secret"
    }),
    "a-production-secret"
  );
});
