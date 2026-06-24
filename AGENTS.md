# vPay

Monorepo for the vPay virtual card app.

## Structure

```
vPay/
├── mobile/          # Expo 53 React Native app
├── backend/         # Express API + Prisma + PostgreSQL
└── docs/            # Design and project docs
```

## Commands

From the repo root:

```bash
npm start              # start Expo dev server
npm run mobile:ios     # iOS simulator
npm run mobile:android
npm run backend        # start API dev server (watch mode)
npm run backend:db:migrate  # run Prisma migrations
```

Or work directly in each package:

```bash
cd mobile && npm install && npm start
cd backend && npm install && npm run dev
```

### Backend setup

1. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL`, `JWT_SECRET`, and `RESEND_API_KEY`.
2. Start PostgreSQL (local or Docker):

```bash
cd backend && docker compose up -d
```

3. Run migrations and start the API:

```bash
npm run backend:setup   # install, prisma generate, migrate
npm run backend         # dev server with watch
```

If installs hang, stop any stuck `npm`/`prisma` processes first, then rerun `npm run backend:setup` once.

## Docs

Read Expo SDK 53 docs at https://docs.expo.dev/versions/v53.0.0/ before writing mobile code.
