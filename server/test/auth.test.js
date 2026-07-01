const assert = require("node:assert/strict");
const test = require("node:test");

const { verifyLogin } = require("../auth.js");

const env = {
  ADMIN_USER: "shop-admin",
  ADMIN_PASS: "strong-test-password"
};

test("accepts configured credentials", () => {
  assert.equal(
    verifyLogin({
      username: "shop-admin",
      password: "strong-test-password",
      env
    }),
    true
  );
});

test("rejects incorrect or missing credentials", () => {
  assert.equal(
    verifyLogin({ username: "shop-admin", password: "wrong", env }),
    false
  );
  assert.equal(verifyLogin({ username: "", password: "", env: {} }), false);
});
