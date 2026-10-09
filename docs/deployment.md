# Phase 11 — Production Deployment & Configuration Guide

This document outlines the architecture, step-by-step procedures, environment configurations, and verification steps for deploying the **Rent & Flatmate Finder** platform to production.

---

## 1. Target Deployment Architecture

The recommended production stack utilizes modern managed services providing TLS, WebSocket support, automatic builds, and zero-maintenance PostgreSQL:

- **Frontend Host**: [Vercel](https://vercel.com) (Single Page Application via React + Vite)
- **Backend Host**: [Render](https://render.com) (Node.js Web Service with Socket.io WebSocket support)
- **Database**: [Render PostgreSQL](https://render.com/docs/databases) (or Supabase / Neon / AWS RDS)
- **Persistent Media**: [Cloudinary](https://cloudinary.com) (Image transformation & CDN delivery)
- **AI Compatibility**: [Google Gemini](https://ai.google.dev) (`gemini-1.5-flash`)
- **Transactional Email**: [Resend](https://resend.com) (REST API provider)

```
                     ┌────────────────────────────────────────┐
                     │          Vercel Edge Network           │
                     │  React 19 + Vite Frontend SPA          │
                     │  (https://<your-frontend>.vercel.app)  │
                     └──────────────────┬─────────────────────┘
                                        │
                         HTTPS REST /   │   WSS WebSocket
                         JSON Payloads  │   Realtime Events
                                        │
                     ┌──────────────────▼─────────────────────┐
                     │               Render                   │
                     │   Express 5 + Socket.io 4 Backend      │
                     │  (https://<your-backend>.onrender.com) │
                     └───────┬──────────┬───────────┬─────────┘
                             │          │           │
            ┌────────────────▼─┐ ┌──────▼───────┐ ┌─▼──────────────┐
            │  Render Managed  │ │  Cloudinary  │ │ Gemini API &   │
            │  PostgreSQL (16) │ │ Media CDN    │ │ Resend Email   │
            └──────────────────┘ └──────────────┘ └────────────────┘
```

---

## 2. Prerequisites & Accounts

Before deploying, ensure you have access to:
1. **GitHub / GitLab Repository**: Containing the project source code.
2. **Render Account**: For the Web Service and Managed PostgreSQL Database.
3. **Vercel Account**: For Frontend SPA hosting.
4. **Cloudinary Account**: Cloud Name, API Key, and API Secret.
5. **Google AI Studio Key**: For `GEMINI_API_KEY`.
6. **Resend Account**: For `RESEND_API_KEY` (and verified domain if using custom sender).

---

## 3. Environment Variables Specification

### 3.1 Backend Variables (`backend/.env`)

| Variable | Required in Prod | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **Yes** | `production` | Enables production security, disables ephemeral uploads, enables Prisma optimizations. |
| `PORT` | No | `5000` (Render sets automatically) | Port on which the HTTP / Socket.io server listens. |
| `FRONTEND_URL` | **Yes** | `https://<your-frontend>.vercel.app` | Allowed CORS and Socket.io origin. Supports comma-separated origins. |
| `DATABASE_URL` | **Yes** | `postgresql://user:pass@host:5432/db?sslmode=require` | Managed PostgreSQL connection string. |
| `JWT_SECRET` | **Yes** | *High-entropy string (≥ 32 chars)* | HMAC SHA-256 secret key for signing user tokens. |
| `JWT_EXPIRES_IN` | No | `7d` | Token expiration duration. |
| `CLOUDINARY_CLOUD_NAME` | **Yes** | `dxy...` | Cloudinary account identifier for persistent listing photos. |
| `CLOUDINARY_API_KEY` | **Yes** | `918...` | Cloudinary access key. |
| `CLOUDINARY_API_SECRET` | **Yes** | *Secret string* | Cloudinary secret key (kept server-side only). |
| `LLM_PROVIDER` | No | `gemini` | Semantic matching provider identifier. |
| `GEMINI_API_KEY` | No* | `AIza...` | Google Gemini key for AI compatibility analysis (falls back safely if missing). |
| `GEMINI_MODEL` | No | `gemini-1.5-flash` | Gemini model name. |
| `EMAIL_PROVIDER` | No | `resend` | Transactional email provider identifier. |
| `RESEND_API_KEY` | No* | `re_...` | Resend API key for interest email delivery (skips safely if missing). |
| `EMAIL_FROM` | No | `Rent & Flatmate Finder <onboarding@resend.dev>` | Verified outbound email address. |

*\*Note: If external AI or email keys are omitted, the application uses deterministic fallback calculations and skips transactional email delivery without throwing errors or breaking user workflows.*

### 3.2 Frontend Variables (`frontend/.env`)

| Variable | Required in Prod | Example | Purpose |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | **Yes** | `https://<your-backend>.onrender.com/api` | Base URL for REST API calls. |
| `VITE_SOCKET_URL` | **Yes** | `https://<your-backend>.onrender.com` | Base URL for Socket.io WebSocket connections. |

> **Security Rule**: Never prefix private server keys with `VITE_`. Any variable starting with `VITE_` is baked directly into client-side JavaScript bundles and readable by all users.

---

## 4. Step-by-Step Deployment Procedure

### Step 4.1: Provision Database (Render PostgreSQL)

1. Navigate to the **Render Dashboard** and select **New +** → **PostgreSQL**.
2. Set configuration:
   - **Name**: `rent-flatmate-db`
   - **Database Name**: `rent_flatmate_db`
   - **User**: `rent_flatmate_user`
   - **Region**: Choose the region closest to your users (e.g., Frankfurt, Oregon, Singapore).
   - **Plan**: Free or Starter.
3. Click **Create Database**.
4. Once provisioned, copy the **Internal Database URL** (if backend is also hosted on Render) or **External Database URL**.
   - Ensure the URL ends with `?sslmode=require`.

### Step 4.2: Deploy Backend (Render Web Service)

#### Method A: Using Render Blueprint (`render.yaml`)
1. In the Render Dashboard, select **New +** → **Blueprint**.
2. Connect your repository. Render automatically reads [`render.yaml`](file:///e:/rent-flatmate-finder/render.yaml) from the repository root.
3. Fill in the prompted secrets (`FRONTEND_URL`, `CLOUDINARY_*`, `GEMINI_API_KEY`, `RESEND_API_KEY`).
4. Click **Apply**. Render will automatically provision the database and build/deploy the backend web service.

#### Method B: Manual Configuration
1. Select **New +** → **Web Service**.
2. Connect your Git repository.
3. Configure the service:
   - **Name**: `rent-flatmate-finder-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Pre-Deploy Command**: `npm run migrate:deploy`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`
4. In the **Environment Variables** tab, add all variables from Section 3.1.
5. Click **Create Web Service**.
6. When deployment finishes, copy your backend URL (e.g. `https://rent-flatmate-finder-backend.onrender.com`).

### Step 4.3: Deploy Frontend (Vercel)

1. Log into **Vercel** and select **Add New...** → **Project**.
2. Import your Git repository.
3. Configure the project:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select `frontend`.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Expand **Environment Variables** and enter:
   - `VITE_API_URL`: `https://<your-backend-app>.onrender.com/api`
   - `VITE_SOCKET_URL`: `https://<your-backend-app>.onrender.com`
5. Click **Deploy**.
6. Vercel automatically deploys the frontend and creates a production URL (e.g. `https://rent-flatmate-finder.vercel.app`).
7. **Important**: Copy your Vercel URL, return to the Render backend service settings, and update `FRONTEND_URL` to match this URL. Render will automatically redeploy the backend with the new allowed origin.

---

## 5. Persistent Image Storage (Cloudinary)

In development, the backend can store images in a local `uploads/` folder. However, cloud environments like Render have ephemeral filesystems: any local files are erased upon container restarts or deployments.

1. Create a free account at [Cloudinary](https://cloudinary.com).
2. Go to your **Cloudinary Dashboard** and locate:
   - **Cloud Name**
   - **API Key**
   - **API Secret**
3. Configure these three values in the Render backend environment variables.
4. When `NODE_ENV=production`, the application strictly disallows local fallback: if Cloudinary credentials are missing or invalid, upload requests safely fail with HTTP 500 (`Cloudinary persistent storage is not configured...`) rather than silently writing to ephemeral disk.

---

## 6. Database Migration Policy

- **Production Migration Command**: `npx prisma migrate deploy`
- All migrations in `prisma/migrations` have been committed to version control and verified.
- The `migrate deploy` command is executed automatically during the pre-deploy release phase in Render before new web service instances accept traffic.
- **Rules**:
  - Never run `prisma db push` against a production database.
  - Never run `prisma db seed` in production. Demo seeds are restricted to test and local development environments.
  - Existing tables and rows are preserved across deployments.

---

## 7. Health Checks and Platform Monitoring

- **Root Health Check**: `GET /health` → `200 { "status": "ok", "service": "rent-flatmate-finder-backend" }`
- **API Health Check**: `GET /api/health` → `200 { "status": "ok", "service": "rent-flatmate-finder-backend" }`
- Used by Render, Docker, or external uptime monitors (UptimeRobot, BetterStack) for zero-downtime health checking.

---

## 8. Rollback Considerations

If an issue arises after deployment:
1. **Frontend**: In the Vercel dashboard, select **Deployments** → locate previous stable deployment → click **Instant Rollback**.
2. **Backend**: In the Render dashboard, select the previous successful build and select **Rollback**.
3. **Database**: Since Prisma migrations are strictly additive (adding nullable fields or new tables), previous code versions remain compatible with newer schema states. Never drop columns or tables without a multi-phase migration strategy.

---

## 9. Common Deployment Pitfalls & Solutions

1. **CORS Blocked Errors in Browser**:
   - *Cause*: `FRONTEND_URL` in backend environment does not exactly match the deployed Vercel domain (e.g. missing `https://` or trailing slash mismatch).
   - *Fix*: Set `FRONTEND_URL=https://<your-project>.vercel.app` (without trailing slash) in backend settings.
2. **WebSocket Connection Failed**:
   - *Cause*: `VITE_SOCKET_URL` pointing to wrong host or protocol.
   - *Fix*: Ensure `VITE_SOCKET_URL=https://<your-backend>.onrender.com`. Socket.io will automatically negotiate `wss://` over HTTPS.
3. **SPA 404 on Page Refresh**:
   - *Cause*: Navigating directly to `/chat` or `/dashboard` triggers static file lookup.
   - *Fix*: [`frontend/vercel.json`](file:///e:/rent-flatmate-finder/frontend/vercel.json) rewrites all non-asset routes to `/index.html`.
4. **Database Connection Refused / SSL Error**:
   - *Cause*: Managed PostgreSQL requires SSL mode.
   - *Fix*: Ensure connection string has `?sslmode=require`.

---

## 10. Post-Deployment Verification Checklist

Execute these smoke tests once production URLs are active:

- [ ] **Health Endpoint**: Navigate to `https://<backend-url>/health` — returns `{ "status": "ok" }`.
- [ ] **Frontend Load**: Navigate to `https://<frontend-url>` — home page renders over HTTPS.
- [ ] **Authentication**: Register a new tenant account and log in — JWT stored, redirected to profile.
- [ ] **Listing Browse**: Search and view rental listings.
- [ ] **Compatibility**: Open listing details as tenant — rule-based & AI compatibility score renders.
- [ ] **Interest Workflow**: Express interest as tenant, log in as owner to accept/decline.
- [ ] **Realtime Chat**: Open accepted conversation as tenant and owner in separate windows — messages deliver in real-time.
- [ ] **Image Upload**: Create listing as owner with photo — photo uploads to Cloudinary and renders via CDN URL.
- [ ] **Route Refresh**: Refresh `/search`, `/chat`, or `/tenant-profile` — page reloads cleanly without 404.
