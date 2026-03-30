const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");

const db = require("./db.js");
const { verifyLogin } = require("./auth.js");
const { requireAuth } = require("./middleware.js");

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === "production";

const PUBLIC_DIR = path.join(__dirname, "..", "public");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());
app.use(
  session({
    name: "butcher.sid",
    secret: process.env.SESSION_SECRET || "dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PROD,
      maxAge: 1000 * 60 * 60 * 12
    }
  })
);

app.use(express.static(PUBLIC_DIR));

db.initDb();

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

function getRequiredText(value, label, { max = 120 } = {}) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > max) throw new Error(`${label} is too long.`);
  return text;
}

function getOptionalText(value, { max = 300 } = {}) {
  const text = String(value || "").trim();
  if (text.length > max) throw new Error(`Text is too long.`);
  return text;
}

function getPositiveNumber(value, label) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`${label} must be greater than 0.`);
  }
  return num;
}

function getNonNegativeNumber(value, label) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`${label} cannot be negative.`);
  }
  return num;
}

function enrichCustomer(c) {
  const balance = db.getBalance(c.id);
  const ageDays = db.debtAgeDays(c.id);
  return { ...c, balance, ageDays };
}

/* ---------------------------
   AUTH
---------------------------- */

app.post("/api/login", (req, res) => {
  const ok = verifyLogin({ ...req.body, env: process.env });
  if (!ok) return res.status(401).json({ error: "Invalid username/password" });

  req.session.user = { username: process.env.ADMIN_USER || "admin" };
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", (req, res) => {
  res.json({ loggedIn: !!(req.session && req.session.user) });
});

/* ---------------------------
   CUSTOMERS
---------------------------- */

app.get("/api/customers", requireAuth, (req, res) => {
  const search = String(req.query.search || "");
  const rows = db.listCustomers({ search, activeOnly: true }).map(enrichCustomer);
  res.json(rows);
});

app.post("/api/customers", requireAuth, (req, res) => {
  try {
    const name = getRequiredText(req.body.name, "Name");
    const phone = getOptionalText(req.body.phone, { max: 40 });
    db.addCustomer(name, phone);
    res.json({ ok: true });
  } catch (e) {
    const status = /unique/i.test(String(e.message || "")) ? 409 : 400;
    res.status(status).json({ error: e.message || String(e) });
  }
});

app.get("/api/stats", requireAuth, (req, res) => {
  const list = db.listCustomers({ search: "", activeOnly: true });
  const total = list.reduce((sum, c) => sum + db.getBalance(c.id), 0);
  res.json({ total });
});

app.get("/api/customers/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const c = db.getCustomer(id);
  if (!c) return res.status(404).json({ error: "Not found" });
  res.json(enrichCustomer(c));
});

app.patch("/api/customers/:id", requireAuth, (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = getRequiredText(req.body.name, "Name");
    const phone = getOptionalText(req.body.phone, { max: 40 });
    db.updateCustomer(id, name, phone);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

app.delete("/api/customers/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);

  const c = db.getCustomer(id);
  if (!c) return res.status(404).json({ error: "Customer not found" });

  const history = db.listHistory(id);
  if (history.length > 0) {
    return res.status(400).json({
      error: "Cannot delete customer with history. Archive the customer instead."
    });
  }

  db.deleteCustomer(id);
  res.json({ ok: true });
});

app.post("/api/customers/:id/archive", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  db.archiveCustomer(id);
  res.json({ ok: true });
});

/* ---------------------------
   LEDGER
---------------------------- */

app.get("/api/customers/:id/history", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  res.json(db.listHistory(id));
});

app.post("/api/customers/:id/purchase", requireAuth, (req, res) => {
  try {
    const customer_id = Number(req.params.id);
    const item = getRequiredText(req.body.item, "Item");
    const quantity = getPositiveNumber(req.body.quantity, "Quantity");
    const unit_price = getPositiveNumber(req.body.unit_price, "Unit price");
    const extras_amount = getNonNegativeNumber(req.body.extras_amount || 0, "Extras amount");
    const extras_note = getOptionalText(req.body.extras_note, { max: 160 });
    const note = getOptionalText(req.body.note, { max: 300 });

    db.addPurchase({
      customer_id,
      item,
      quantity,
      unit_price,
      extras_amount,
      extras_note,
      note
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

app.post("/api/customers/:id/payment", requireAuth, (req, res) => {
  try {
    const customer_id = Number(req.params.id);
    const amount = getPositiveNumber(req.body.amount, "Amount");
    const note = getOptionalText(req.body.note, { max: 300 });

    db.addPayment({
      customer_id,
      amount,
      note
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

app.get("/api/customers/:cid/ledger/:lid", requireAuth, (req, res) => {
  const customer_id = Number(req.params.cid);
  const ledger_id = Number(req.params.lid);

  const row = db.getLedger(ledger_id);
  if (!row || row.customer_id !== customer_id) {
    return res.status(404).json({ error: "Not found" });
  }
  res.json(row);
});

app.patch("/api/customers/:cid/ledger/:lid", requireAuth, (req, res) => {
  try {
    const customer_id = Number(req.params.cid);
    const ledger_id = Number(req.params.lid);

    const row = db.getLedger(ledger_id);
    if (!row || row.customer_id !== customer_id) {
      return res.status(404).json({ error: "Not found" });
    }

    const type = String(req.body.type || row.type);

    if (type === "purchase") {
      db.updatePurchase(ledger_id, {
        item: getRequiredText(req.body.item, "Item"),
        quantity: getPositiveNumber(req.body.quantity, "Quantity"),
        unit_price: getPositiveNumber(req.body.unit_price, "Unit price"),
        extras_amount: getNonNegativeNumber(req.body.extras_amount || 0, "Extras amount"),
        extras_note: getOptionalText(req.body.extras_note, { max: 160 }),
        note: getOptionalText(req.body.note, { max: 300 })
      });

      return res.json({ ok: true });
    }

    if (type === "payment") {
      db.updatePayment(ledger_id, {
        amount: getPositiveNumber(req.body.amount, "Amount"),
        note: getOptionalText(req.body.note, { max: 300 })
      });
      return res.json({ ok: true });
    }

    return badRequest(res, "Invalid type");
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

app.delete("/api/customers/:cid/ledger/:lid", requireAuth, (req, res) => {
  return res.status(409).json({
    error: "Deleting ledger lines is disabled for safety. Edit the line instead."
  });
});

app.post("/api/customers/:id/undo", requireAuth, (req, res) => {
  return res.status(409).json({
    error: "Undo is disabled for safety. Edit the last line instead."
  });
});

/* ---------------------------
   ALERTS
---------------------------- */

app.get("/api/alerts/summary", requireAuth, (req, res) => {
  const mode = String(req.query.mode || "biggest");
  const limit = Math.min(200, Math.max(10, Number(req.query.limit || 50)));

  const snoozed = db.listActiveSnoozesNow();

  const customers = db.listCustomers({ search: "", activeOnly: true }).map((c) => {
    const balance = db.getBalance(c.id);
    const ageDays = db.debtAgeDays(c.id);
    const inactiveDays = db.lastActivityDays(c.id);
    const firstDebtAt = db.getFirstDebtDate(c.id);
    const lastActivityAt = db.getLastActivityDate(c.id);

    const reasons = [];
    if (balance >= 1000) reasons.push("DEBT_1000");
    if (ageDays >= 30) reasons.push("AGE_30_DAYS");
    if (inactiveDays >= 14 && balance > 0) reasons.push("NO_ACTIVITY_14_DAYS");

    const bucket =
      ageDays >= 180 ? "180+"
      : ageDays >= 61 ? "61-180"
      : ageDays >= 31 ? "31-60"
      : "0-30";

    return {
      id: c.id,
      name: c.name,
      phone: c.phone || "",
      balance,
      ageDays,
      inactiveDays,
      firstDebtAt,
      lastActivityAt,
      bucket,
      reasons,
      snoozedUntil: snoozed.get(c.id) || null
    };
  });

  const flagged = customers.filter((c) => c.reasons.length > 0);
  const actionable = flagged.filter((c) => !c.snoozedUntil);

  let list = actionable;

  if (mode === "oldest") list = actionable.sort((a, b) => b.ageDays - a.ageDays);
  else if (mode === "inactive") list = actionable.sort((a, b) => b.inactiveDays - a.inactiveDays);
  else if (mode === "all") list = flagged.sort((a, b) => b.balance - a.balance);
  else list = actionable.sort((a, b) => b.balance - a.balance);

  list = list.slice(0, limit);

  const buckets = { "0-30": 0, "31-60": 0, "61-180": 0, "180+": 0 };
  for (const c of actionable) buckets[c.bucket] = (buckets[c.bucket] || 0) + 1;

  res.json({
    count: actionable.length,
    totalFlagged: flagged.length,
    buckets,
    alerts: list
  });
});

app.post("/api/alerts/snooze", requireAuth, (req, res) => {
  const customer_id = Number(req.body.customer_id);
  const days = Number(req.body.days || 7);
  const reason = String(req.body.reason || "Snoozed");

  if (!customer_id || days <= 0) {
    return res.status(400).json({ error: "customer_id and positive days are required" });
  }

  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  db.setSnooze(customer_id, until, reason);
  res.json({ ok: true, snooze_until: until });
});

app.post("/api/alerts/unsnooze", requireAuth, (req, res) => {
  const customer_id = Number(req.body.customer_id);
  if (!customer_id) return res.status(400).json({ error: "customer_id required" });

  db.clearSnooze(customer_id);
  res.json({ ok: true });
});

/* ---------------------------
   PRICES
---------------------------- */

app.get("/api/prices", requireAuth, (req, res) => {
  res.json(db.listPrices());
});

app.post("/api/prices", requireAuth, (req, res) => {
  try {
    const item = getRequiredText(req.body.item, "Item");
    const unit_price = getPositiveNumber(req.body.unit_price, "Unit price");
    db.setPrice(item, unit_price);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

app.delete("/api/prices", requireAuth, (req, res) => {
  try {
    const item = getRequiredText(req.body.item, "Item");
    db.deletePrice(item);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

app.get("/", (req, res) => res.redirect("/login.html"));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running: http://localhost:${PORT}/login.html`);
});
