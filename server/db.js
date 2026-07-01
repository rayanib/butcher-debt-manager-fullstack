const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "butcher.db");
let db;

/**
 * Opens SQLite DB and creates tables if missing.
 */
function initDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      phone TEXT DEFAULT '',
      is_archived INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('purchase','payment')),
      item TEXT DEFAULT '',
      quantity REAL DEFAULT 0,
      unit_price REAL DEFAULT 0,
      extras_amount REAL DEFAULT 0,
      extras_note TEXT DEFAULT '',
      amount REAL DEFAULT 0,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS prices (
      item TEXT PRIMARY KEY,
      unit_price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alert_snoozes (
      customer_id INTEGER PRIMARY KEY,
      snooze_until TEXT NOT NULL,
      reason TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
  `);

  const ledgerCols = db.prepare(`PRAGMA table_info(ledger)`).all().map(c => c.name);

  if (!ledgerCols.includes("extras_amount")) {
    db.exec(`ALTER TABLE ledger ADD COLUMN extras_amount REAL DEFAULT 0`);
  }
  if (!ledgerCols.includes("extras_note")) {
    db.exec(`ALTER TABLE ledger ADD COLUMN extras_note TEXT DEFAULT ''`);
  }
}

/* ---------------------------
   CUSTOMERS
---------------------------- */

function addCustomer(name, phone = "") {
  db.prepare("INSERT INTO customers (name, phone) VALUES (?, ?)")
    .run(String(name).trim(), String(phone || "").trim());
}

function listCustomers({ search = "", activeOnly = true }) {
  const s = String(search || "").trim();
  const where = [];
  const params = {};

  if (activeOnly) where.push("is_archived = 0");
  if (s) {
    where.push("name LIKE @q");
    params.q = `%${s}%`;
  }

  const sql = `
    SELECT id, name, phone, is_archived, created_at
    FROM customers
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY name COLLATE NOCASE ASC
  `;
  return db.prepare(sql).all(params);
}

function getCustomer(id) {
  return db.prepare(`
    SELECT id, name, phone, is_archived, created_at
    FROM customers
    WHERE id=?
  `).get(id);
}

function updateCustomer(id, name, phone = "") {
  db.prepare("UPDATE customers SET name=?, phone=? WHERE id=?")
    .run(String(name).trim(), String(phone || "").trim(), id);
}

function archiveCustomer(id) {
  db.prepare("UPDATE customers SET is_archived=1 WHERE id=?").run(id);
}

function deleteCustomer(id) {
  const trx = db.transaction((customerId) => {
    db.prepare("DELETE FROM ledger WHERE customer_id=?").run(customerId);
    db.prepare("DELETE FROM alert_snoozes WHERE customer_id=?").run(customerId);
    db.prepare("DELETE FROM customers WHERE id=?").run(customerId);
  });

  trx(id);
}

/* ---------------------------
   LEDGER
---------------------------- */

function addPurchase({
  customer_id,
  item,
  quantity,
  unit_price,
  extras_amount = 0,
  extras_note = "",
  note = ""
}) {
  const q = Number(quantity);
  const up = Number(unit_price);
  const ea = Number(extras_amount || 0);
  const amount = (q * up) + ea;

  db.prepare(`
    INSERT INTO ledger (
      customer_id, type, item, quantity, unit_price, extras_amount, extras_note, amount, note
    )
    VALUES (?, 'purchase', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    customer_id,
    String(item || ""),
    q,
    up,
    ea,
    String(extras_note || ""),
    amount,
    String(note || "")
  );
}

function addPayment({ customer_id, amount, note = "" }) {
  const a = Number(amount);

  db.prepare(`
    INSERT INTO ledger (customer_id, type, amount, note)
    VALUES (?, 'payment', ?, ?)
  `).run(customer_id, a, String(note || ""));
}

function listHistory(customer_id) {
  return db.prepare(`
    SELECT id, type, item, quantity, unit_price, extras_amount, extras_note, amount, note, created_at
    FROM ledger
    WHERE customer_id=?
    ORDER BY id DESC
  `).all(customer_id);
}

function getLedger(id) {
  return db.prepare(`
    SELECT id, customer_id, type, item, quantity, unit_price, extras_amount, extras_note, amount, note, created_at
    FROM ledger
    WHERE id=?
  `).get(id);
}

function updatePurchase(id, {
  item,
  quantity,
  unit_price,
  extras_amount = 0,
  extras_note = "",
  note = ""
}) {
  const q = Number(quantity);
  const up = Number(unit_price);
  const ea = Number(extras_amount || 0);
  const amount = (q * up) + ea;

  db.prepare(`
    UPDATE ledger
    SET item=?, quantity=?, unit_price=?, extras_amount=?, extras_note=?, amount=?, note=?
    WHERE id=? AND type='purchase'
  `).run(
    String(item || ""),
    q,
    up,
    ea,
    String(extras_note || ""),
    amount,
    String(note || ""),
    id
  );
}

function updatePayment(id, { amount, note = "" }) {
  const a = Number(amount);

  db.prepare(`
    UPDATE ledger
    SET amount=?, note=?
    WHERE id=? AND type='payment'
  `).run(a, String(note || ""), id);
}

function getBalance(customer_id) {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type='purchase' THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN type='payment' THEN amount ELSE 0 END), 0) AS balance
    FROM ledger
    WHERE customer_id=?
  `).get(customer_id);

  return Number(row.balance || 0);
}

function getFirstDebtDate(customer_id) {
  const row = db.prepare(`
    SELECT MIN(created_at) AS first_debt
    FROM ledger
    WHERE customer_id=? AND type='purchase'
  `).get(customer_id);

  return row && row.first_debt ? String(row.first_debt) : null;
}

function getLastActivityDate(customer_id) {
  const row = db.prepare(`
    SELECT MAX(created_at) AS last_activity
    FROM ledger
    WHERE customer_id=?
  `).get(customer_id);

  return row && row.last_activity ? String(row.last_activity) : null;
}

function debtAgeDays(customer_id) {
  const first = getFirstDebtDate(customer_id);
  if (!first) return 0;

  const firstMs = new Date(first.replace(" ", "T") + "Z").getTime();
  const nowMs = Date.now();
  const days = Math.floor((nowMs - firstMs) / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

function lastActivityDays(customer_id) {
  const last = getLastActivityDate(customer_id);
  if (!last) return 999999;

  const lastMs = new Date(last.replace(" ", "T") + "Z").getTime();
  const nowMs = Date.now();
  const days = Math.floor((nowMs - lastMs) / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

/* ---------------------------
   PRICES
---------------------------- */

function listPrices() {
  return db.prepare("SELECT item, unit_price FROM prices ORDER BY item ASC").all();
}

function setPrice(item, unit_price) {
  db.prepare(`
    INSERT INTO prices (item, unit_price) VALUES (?, ?)
    ON CONFLICT(item) DO UPDATE SET unit_price=excluded.unit_price
  `).run(String(item).trim(), Number(unit_price));
}

function deletePrice(item) {
  db.prepare("DELETE FROM prices WHERE item=?").run(String(item).trim());
}

/* ---------------------------
   ALERT SNOOZE
---------------------------- */

function setSnooze(customer_id, snooze_until, reason = "") {
  db.prepare(`
    INSERT INTO alert_snoozes (customer_id, snooze_until, reason)
    VALUES (?, ?, ?)
    ON CONFLICT(customer_id) DO UPDATE SET snooze_until=excluded.snooze_until, reason=excluded.reason
  `).run(customer_id, String(snooze_until), String(reason || ""));
}

function clearSnooze(customer_id) {
  db.prepare(`DELETE FROM alert_snoozes WHERE customer_id=?`).run(customer_id);
}

function listActiveSnoozesNow() {
  const rows = db.prepare(`
    SELECT customer_id, snooze_until
    FROM alert_snoozes
    WHERE snooze_until > datetime('now')
  `).all();

  const m = new Map();
  for (const r of rows) m.set(Number(r.customer_id), String(r.snooze_until));
  return m;
}

/* ---------------------------
   EXPORTS
---------------------------- */

module.exports = {
  initDb,

  addCustomer,
  listCustomers,
  getCustomer,
  updateCustomer,
  archiveCustomer,
  deleteCustomer,

  addPurchase,
  addPayment,
  listHistory,
  getLedger,
  updatePurchase,
  updatePayment,
  getBalance,
  getFirstDebtDate,
  getLastActivityDate,
  debtAgeDays,
  lastActivityDays,
  listPrices,
  setPrice,
  deletePrice,

  setSnooze,
  clearSnooze,
  listActiveSnoozesNow
};
