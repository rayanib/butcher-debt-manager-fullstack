# Butcher Debt Manager (Fullstack)

A simple, fast debt-tracking web app for a butcher shop:
track customer purchases, payments, and balance with a clean UI designed for daily work.

## Features
- Add and manage customers
- Record purchases (item, quantity, unit price, note)
- Record payments (amount, note)
- Automatic balance calculation (purchases - payments)
- Customer history (ledger)
- Edit/delete a single history line (safe editing)
- Total debt on main customers page
- Prices list (autocomplete + quick entry)
- Alerts (big debt / old debt / inactive) + snooze
- Arabic/Hebrew friendly UI (RTL-ready fonts)

## Tech Stack
- Node.js + Express
- SQLite (better-sqlite3)
- Vanilla HTML/CSS/JS (no heavy frontend framework)

## How to Run (Local)
1) Install dependencies:
```bash
cd server
npm install