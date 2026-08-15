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
