# Railway Deploy Guide

This project can use Railway for hosting the backend and PostgreSQL for the database.

## 1. Create the database

1. Create a new Railway project.
2. Add a PostgreSQL service.
3. Copy the generated `DATABASE_URL`.

## 2. Set backend environment variables

Set these in the Railway backend service:

```env
DATABASE_URL="postgresql://..."
RAKUTEN_APP_ID="your-rakuten-app-id"
RAKUTEN_AFFILIATE_ID="optional"
RAKUTEN_KEYWORD="プロテイン"
PORT=4000
```

## 3. Run Prisma migrations

Use the Prisma migration command during deploy.

```bash
npm --prefix backend run prisma:deploy
npm --prefix backend run prisma:seed
```

If you are using Railway's deploy pipeline, prefer a production-safe migration command such as `prisma migrate deploy`.

## 4. Deploy the backend

- Use `npm --prefix backend run start` as the start command.
- Confirm `GET /api/health` works.
- Confirm `GET /api/products` works.
- Confirm `GET /api/sync/providers` includes `rakuten`.

## 5. Deploy the frontend

- Set the frontend API base URL to the Railway backend URL.
- Build with `npm run build`.
- Deploy to Vercel, Netlify, or another static host.

## 6. Register Allowed websites

Add the backend public domain to the Rakuten Allowed websites list.

Example:

```text
https://your-backend.up.railway.app
```

## 7. Smoke test

```bash
curl -X POST https://your-backend.up.railway.app/api/sync \
  -H "Content-Type: application/json" \
  -d '{"provider":"rakuten","keyword":"プロテイン","hits":20,"pages":1}'
```
