# Security Policy

## Reporting

Do not publish credentials, customer data, database files, or exploit details in
a public issue. Contact the maintainer privately through the email listed on the
GitHub profile.

## Deployment checklist

- Set `NODE_ENV=production`.
- Use a long, random `SESSION_SECRET`.
- Use strong administrator credentials.
- Terminate TLS before the Express application.
- Restrict network access to the intended shop/users.
- Back up the SQLite database securely.
- Do not commit `.env` or database files.

This application currently uses one environment-configured administrator. It is
not designed as an internet-facing multi-tenant authentication system.
