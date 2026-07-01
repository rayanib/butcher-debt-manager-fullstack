# Contributing

Keep changes focused and preserve the ledger's safety rules.

Before opening a pull request:

```bash
cd server
npm install
npm test
node --check server.js
```

Include tests for changes to validation, authentication, calculations, or SQL.
Never commit `.env`, SQLite databases, customer data, logs, or `node_modules`.

Use concise imperative commits, for example:

```text
refactor: extract request validation
security: rate limit login attempts
test: cover purchase and payment balances
docs: document debt ledger API
```
