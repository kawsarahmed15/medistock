# PM2 Deployment Steps

Run these commands from:

- `/home/teklin.in/medistock.teklin.in`

## 1) Install dependencies

```bash
npm install
cd backend && npm install && cd ..
```

## 2) Run MySQL migration

```bash
npm --prefix backend run migrate
```

## 3) Build frontend

```bash
npm run build
```

## 4) Install PM2 (if not installed)

```bash
npm install -g pm2
```

## 5) Start services with PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## 6) Useful PM2 commands

```bash
pm2 ls
pm2 logs medistock-backend --lines 100
pm2 logs medistock-frontend --lines 100
pm2 restart medistock-backend
pm2 restart medistock-frontend
```

## 7) Reverse proxy (recommended)

- Proxy `/api` to backend on `127.0.0.1:4000`
- Serve frontend from PM2 preview on `127.0.0.1:4173`

For high-traffic production, static frontend can be served directly by Nginx from `dist/`.
