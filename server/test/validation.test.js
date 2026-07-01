const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getRequiredText,
  getPositiveNumber,
  getNonNegativeNumber,
  getPositiveInteger
} = require("../validation.js");

test("trims required text and enforces maximum length", () => {
  assert.equal(getRequiredText("  customer  ", "Name"), "customer");
  assert.throws(() => getRequiredText("", "Name"), /Name is required/);
  assert.throws(
    () => getRequiredText("too long", "Name", { max: 3 }),
    /Name is too long/
  );
});

test("validates ledger numbers", () => {
  assert.equal(getPositiveNumber("2.5", "Quantity"), 2.5);
  assert.equal(getNonNegativeNumber(0, "Extras"), 0);
  assert.throws(() => getPositiveNumber(0, "Quantity"), /greater than 0/);
  assert.throws(() => getNonNegativeNumber(-1, "Extras"), /cannot be negative/);
});

test("validates route identifiers", () => {
  assert.equal(getPositiveInteger("42"), 42);
  assert.throws(() => getPositiveInteger("1.5"), /positive integer/);
});
