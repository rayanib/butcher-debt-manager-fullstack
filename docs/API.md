# API Reference

All operational endpoints require an authenticated session unless noted.
Responses use JSON.

## Authentication

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/login` | Create a session; public and rate-limited |
| `POST` | `/api/logout` | Destroy the current session |
| `GET` | `/api/me` | Return current login state |
| `GET` | `/api/health` | Health check; public |

## Customers

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/customers` | List/search active customers |
| `POST` | `/api/customers` | Create a customer |
| `GET` | `/api/customers/:id` | Get customer and balance |
| `PATCH` | `/api/customers/:id` | Update customer details |
| `DELETE` | `/api/customers/:id` | Delete a customer without history |
| `POST` | `/api/customers/:id/archive` | Archive a customer |
| `GET` | `/api/stats` | Return total outstanding debt |

## Ledger

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/customers/:id/history` | List ledger entries |
| `POST` | `/api/customers/:id/purchase` | Record a purchase |
| `POST` | `/api/customers/:id/payment` | Record a payment |
| `GET` | `/api/customers/:cid/ledger/:lid` | Get one ledger entry |
| `PATCH` | `/api/customers/:cid/ledger/:lid` | Correct one ledger entry |

Ledger deletion and undo endpoints return `409 Conflict` by design.

## Alerts and prices

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/alerts/summary` | List actionable debt alerts |
| `POST` | `/api/alerts/snooze` | Snooze a customer alert |
| `POST` | `/api/alerts/unsnooze` | Remove an alert snooze |
| `GET` | `/api/prices` | List saved prices |
| `POST` | `/api/prices` | Create or update a price |
| `DELETE` | `/api/prices` | Delete a saved price |

## Error format

```json
{
  "error": "Human-readable message"
}
```
