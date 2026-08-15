# ZEVQORA Backend

Standalone Node.js/Express API for orders, PostgreSQL storage, Cashfree payments, webhooks and order tracking.

## Local setup
1. `npm install`
2. Copy `.env.example` to `.env` and fill in values.
3. Create PostgreSQL DB and run `schema.sql`.
4. `npm start`

## Render
Create a Web Service from this backend folder/repository. Build command: `npm install`. Start command: `npm start`. Add the environment variables from `.env.example`.

Do not put Cashfree secret keys in the frontend.

## Cashfree production setup

- `CASHFREE_ENV=production` must be used with production Cashfree client ID/secret.
- `CASHFREE_ENV=sandbox` must be used with sandbox/test credentials. Cashfree's web SDK must use the same environment as the server-created payment session.
- Set `FRONTEND_BASE_URL` to the actual public frontend URL so Cashfree returns the customer to the storefront after checkout. Keep `PUBLIC_BASE_URL` as the backend URL for the webhook.
- Never put `CASHFREE_CLIENT_SECRET` in the frontend or commit a real `.env` file.
