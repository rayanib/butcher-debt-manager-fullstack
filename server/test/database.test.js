const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

process.env.DB_PATH = path.join(
  os.tmpdir(),
  `butcher-debt-test-${process.pid}-${Date.now()}.sqlite`
);

const db = require("../db.js");

test("calculates a customer balance from purchases and payments", () => {
  db.initDb();
  db.addCustomer("Test Customer", "0500000000");

  const customer = db.listCustomers({
    search: "Test Customer",
    activeOnly: true
  })[0];

  db.addPurchase({
    customer_id: customer.id,
    item: "Test Item",
    quantity: 2,
    unit_price: 50,
    extras_amount: 10
  });
  db.addPayment({ customer_id: customer.id, amount: 30 });

  assert.equal(db.getBalance(customer.id), 80);
  assert.equal(db.listHistory(customer.id).length, 2);
});
