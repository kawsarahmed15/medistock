# MediStock Backend (MySQL + SMTP)

This backend replaces Supabase auth/data with MySQL and SMTP-based account flows.

## Features

- JWT auth with secure password hashing (bcrypt)
- Signup with email verification link
- Login with verified-account enforcement
- Forgot/reset password by email link
- Profile name update and password change
- Product, bill, and customer APIs
- Basic production security: helmet, CORS, auth rate-limiting

## Environment

Copy `.env.example` to `.env` and set production values.

Important variables:

- `APP_BASE_URL`: frontend URL (used in verification/reset links)
- `MYSQL_*`: MySQL credentials
- `SMTP_*`: SMTP credentials for no-reply sender
- `JWT_SECRET`: long random secret
- `CORS_ORIGIN`: frontend origin(s), comma-separated if multiple

## Setup

1. Install dependencies:

```bash
cd backend
npm install
```

2. Create schema:

```bash
mysql -u tekl_medistock -p tekl_medistock < sql/schema.sql
```

3. Start server:

```bash
npm run start
```

Health check:

- `GET /api/health`

## API Endpoints

Auth:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/verify-email?token=...`
- `POST /api/auth/resend-verification`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/me`
- `PATCH /api/auth/profile`
- `POST /api/auth/change-password`

Data:

- `GET|POST /api/products`
- `PATCH|DELETE /api/products/:id`
- `POST /api/products/:id/decrement`
- `GET|POST /api/bills`
- `GET /api/bills/:id`
- `GET /api/customers`

## Notes for Production

- Put backend behind Nginx/Apache reverse proxy and expose only HTTPS.
- Set a strong random `JWT_SECRET`.
- Keep `.env` out of version control.
- Run backend using PM2/systemd.
