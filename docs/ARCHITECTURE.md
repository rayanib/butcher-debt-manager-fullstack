# Architecture

## Runtime

Express serves both the static browser interface and the JSON API. Operational
API routes require an authenticated server-side session.

SQLite is accessed through synchronous `better-sqlite3` statements. For this
single-shop workload, synchronous local queries keep the implementation simple
and transactions predictable.

## Data model

- `customers`: customer identity and archive status
- `ledger`: purchases and payments
- `prices`: reusable unit prices
- `alert_snoozes`: temporary follow-up suppression

A customer's balance is calculated from ledger entries:

```text
sum(purchases) - sum(payments)
```

Ledger deletion is disabled through the API. Corrections are made by editing a
specific entry, reducing the chance of silently losing financial history.

## Security boundary

The browser receives a signed session cookie after a successful login. Protected
routes use `requireAuth` before reading or modifying business data.

The application also uses:

- HTTP-only and same-site cookies
- Secure cookies in production
- Timing-safe credential comparison
- Login rate limiting
- Helmet response headers
- Parameterized SQL
- Request validation and body-size limits

## Deployment constraints

The default Express memory session store and local SQLite file assume one server
process. A multi-instance deployment would require shared session storage and a
network database.

## Next structural step

If the API grows, move each domain into route/service/repository modules:

```text
modules/
  customers/
  ledger/
  alerts/
  prices/
```

The current code separates configuration, authentication, validation, and data
access first, avoiding unnecessary abstractions for a small application.
