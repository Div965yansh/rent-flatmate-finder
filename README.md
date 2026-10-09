# Rent & Flatmate Finder 🏠✨

[![Tests](https://img.shields.io/badge/backend%20tests-230%20passing-brightgreen)](#-automated-testing--verification)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-blue)](https://nodejs.org)
[![Express](https://img.shields.io/badge/express-v5.2.1-lightgrey)](https://expressjs.com)
[![React](https://img.shields.io/badge/react-v19.2.8-61dafb)](https://react.dev)
[![Vite](https://img.shields.io/badge/vite-v8.3.0-646cff)](https://vitejs.dev)
[![Prisma](https://img.shields.io/badge/prisma-v6.19.3-2d3748)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16-336791)](https://www.postgresql.org)
[![Socket.io](https://img.shields.io/badge/realtime-socket.io%204.8-010101)](https://socket.io)

An AI-powered rental and roommate matching platform that connects property owners with prospective tenants and pair compatible flatmates through deterministic scoring, semantic Gemini AI analysis, transactional notifications, and real-time messaging.

---

## 🌟 Key Features

### 🔑 Authentication & Role-Based Access Control (RBAC)
- **Roles**: `TENANT`, `OWNER`, and `ADMIN`.
- Secure password hashing using **bcrypt** (salt rounds = 10).
- Stateless authentication with **JWT** (pinned `HS256` algorithm).
- Server-side role enforcement on every protected endpoint and socket handshake.

### 🏡 Rental Listings & Image Management
- Property Owners can create, edit, mark filled, and delete rental listings.
- Rich search and filtering: location keyword matching, rent price bounds, room type (`SINGLE`, `SHARED`, `ENTIRE_FLAT`), and furnishing level.
- Multi-image uploads via **Cloudinary** (persistent CDN storage) with strict server-side MIME and extension validation (`JPEG`, `PNG`, `WebP`).

### 👤 Tenant Profiling & Lifestyle Preferences
- Tenants can maintain structured lifestyle profiles: preferred locations, budget min/max, target move-in dates, room preferences, and lifestyle tags (smoking, pets, vegetarian diet, quiet living).

### 🧠 Dual-Engine Compatibility Matching
1. **Deterministic Rule Engine (0–100 points)**:
   - Budget fit (30 pts), location relevance (25 pts), room type (15 pts), furnishing (15 pts), move-in date (10 pts), and lifestyle habits (5 pts).
2. **Google Gemini Semantic AI**:
   - Provides natural language qualitative match summaries, strengths, and potential concerns (`gemini-1.5-flash`).
   - Built with deterministic fallback: if the AI provider times out or API keys are missing, matching falls back gracefully without interrupting user workflows.

### 💌 Interest Workflow & Transactional Notifications
- Tenants express interest in available listings.
- Property owners review tenant profiles in an Interest Inbox and can **Accept** or **Decline**.
- Automated transactional email dispatches powered by **Resend** (tenant interest alert, owner accept/decline updates).

### 💬 Realtime Chat (Socket.io)
- **Server-Authoritative Chat**: Messaging is permitted **only** when an interest status is `ACCEPTED` between the specific tenant and listing owner.
- Real-time message broadcast, optimistic local delivery, and conversation room isolation (`interest:<id>`).
- Real-time account deactivation protection: deactivated users are blocked from sending messages and immediately disconnected.

### 🛡️ Admin Dashboard & Platform Moderation
- System-wide visibility: overview metrics, user management (activate/deactivate accounts), listing moderation, interest workflow logs, and conversation audits.

### 🔒 Production Hardened & Audited
- Security headers with **Helmet** (`crossOriginResourcePolicy: cross-origin`).
- Technology fingerprinting disabled (`app.disable('x-powered-by')`).
- Tiered rate limiting via **express-rate-limit** across authentication, AI queries, messaging, and global routes.
- Request payload size capping (`1MB`) and safe sanitized error responses without leaking stack traces or internal secrets.

---

## 🛠️ Tech Stack

| Tier | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS v4, React Router 7, Axios, Socket.io Client |
| **Backend** | Node.js (ESM), Express 5, Socket.io 4, Prisma ORM, Helmet, Express-Rate-Limit, Multer |
| **Database** | PostgreSQL 16 (Relational storage with Prisma migrations) |
| **External Providers** | Cloudinary (Images), Google Gemini (AI Matching), Resend (Transactional Emails) |
| **Deployment Targets** | Vercel (Frontend SPA), Render (Backend Web Service + Managed PostgreSQL) |

---

## 📁 Repository Structure

```
rent-flatmate-finder/
├── backend/
│   ├── prisma/
│   │   ├── migrations/          # 6 committed Prisma SQL migrations
│   │   ├── schema.prisma        # Database schema definition
│   │   └── seed.js              # Database seeder with demo accounts
│   ├── src/
│   │   ├── config/              # Prisma client initialization
│   │   ├── controllers/         # Express request handlers
│   │   ├── middleware/          # Auth, role, error, and rate-limiting middleware
│   │   ├── routes/              # Modular Express REST routes
│   │   ├── schemas/             # Zod input validation schemas
│   │   ├── services/            # Core business logic (auth, chat, listings, AI, email)
│   │   ├── socket/              # Socket.io authentication and event handlers
│   │   ├── utils/               # JWT, password hashing, and custom errors
│   │   ├── app.js               # Express application configuration
│   │   └── server.js            # HTTP + Socket.io server with graceful shutdown
│   ├── tests/                   # 12 test suites (230 tests total)
│   ├── .env.example             # Backend environment template
│   └── package.json
├── frontend/
│   ├── public/                  # Static assets & SPA _redirects
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   ├── context/             # AuthContext (JWT state & user profile)
│   │   ├── pages/               # React Router page views
│   │   ├── services/            # Axios API client & Socket.io manager
│   │   ├── utils/               # Color scoring and formatting helpers
│   │   ├── App.jsx              # App layout and route declarations
│   │   └── main.jsx             # React entry point
│   ├── .env.example             # Frontend environment template
│   ├── vercel.json              # Vercel SPA routing rewrites
│   ├── vite.config.js           # Vite configuration
│   └── package.json
├── docs/
│   ├── deployment.md            # Production deployment runbook
│   ├── phase-10-security-audit.md # Full security audit report
│   └── system-design.md         # Architecture and system design
├── render.yaml                  # Render Blueprint Infrastructure-as-Code
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: `v20.0.0` or higher
- **PostgreSQL**: Running locally on port `5432`
- **Git**

### 2. Clone Repository
```bash
git clone https://github.com/Div965yansh/rent-flatmate-finder.git
cd rent-flatmate-finder
```

### 3. Backend Setup

```bash
cd backend

# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# Edit .env and set your DATABASE_URL, for example:
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rent_flatmate_db"
# JWT_SECRET="your-super-secret-jwt-key-min-32-chars-long"

# 3. Apply database migrations
npx prisma migrate dev

# 4. Seed demo accounts and listings
node prisma/seed.js

# 5. Start development server
npm run dev
```

The backend server will start on `http://localhost:5000`.  
Verify health by visiting `http://localhost:5000/health`.

### 4. Frontend Setup

In a new terminal window:

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# Default localhost URLs will work out-of-the-box:
# VITE_API_URL=http://localhost:5000/api
# VITE_SOCKET_URL=http://localhost:5000

# 3. Start development server
npm run dev
```

The frontend application will be live at `http://localhost:5173`.

---

## 👥 Demo Accounts (Pre-Seeded)

All demo accounts share the password: **`DevPassword123!`**

| Role | Email | Use Case |
| :--- | :--- | :--- |
| **System Admin** | `admin@example.com` | User management, listing audits, chat inspection |
| **Property Owner 1** | `owner1@example.com` | Create/edit listings, manage incoming tenant interests |
| **Property Owner 2** | `owner2@example.com` | Multi-owner listing separation testing |
| **Tenant 1** | `tenant1@example.com` | Profile preferences, calculate AI matches, chat with owners |
| **Tenant 2** | `tenant2@example.com` | Multi-tenant roommate discovery |

---

## 🧪 Automated Testing & Verification

The platform maintains an automated test suite across all architectural layers:

### Backend Tests (Node Test Runner)
```bash
cd backend
npm test
```
```text
ℹ tests 230
ℹ suites 12
ℹ pass 230
ℹ fail 0
```
- **Test Suites**:
  - `admin.test.js`: System admin platform controls and metrics.
  - `auth.test.js`: Registration, login, password hashing, and token validation.
  - `compatibility.test.js`: Deterministic scoring algorithms.
  - `email.test.js`: Resend provider abstraction and fallback handling.
  - `interest.test.js`: Tenant expression of interest and owner state transitions.
  - `listing-search.test.js`: Advanced property search and query filtering.
  - `listing.test.js`: Listing creation, editing, and authorization.
  - `llm-compatibility.test.js`: Gemini AI semantic match engine and fallback.
  - `message.test.js`: REST chat history, pagination, and accepted-interest authorization.
  - `security-hardening.test.js`: Helmet headers, Multer upload security, rate limiting, and deactivation disconnects.
  - `seed-verification.test.js`: Database seeding consistency.
  - `socket.test.js`: Real-time WebSocket handshake, room joins, and messaging.

### Frontend Production Build & Lint
```bash
cd frontend

# Production bundle compilation
npm run build
# Result: 0 errors

# Code quality check
npm run lint
# Result: 0 errors
```

### Database Verification
```bash
cd backend

# Validate Prisma schema
npx prisma validate

# Check migration alignment
npx prisma migrate status
```

---

## 🌐 Production Deployment

For complete, step-by-step instructions on deploying the application to **Vercel** and **Render**, refer to the deployment runbook:

📖 **[Read the Production Deployment Guide (docs/deployment.md)](docs/deployment.md)**

### Quick Render Deployment
This repository includes a [`render.yaml`](render.yaml) blueprint. In the Render Dashboard, simply click **New +** → **Blueprint** and select this repository to provision the backend web service and managed PostgreSQL database with release migration commands.

### Vercel SPA Routing
The frontend includes [`frontend/vercel.json`](frontend/vercel.json) configured with route rewrites to ensure deep links (e.g. `/chat`, `/search`) function on page refresh.

---

## 📄 Documentation

- 📘 [System Architecture & Design (`docs/system-design.md`)](docs/system-design.md)
- 🔒 [Security Audit & Vulnerability Remediation (`docs/phase-10-security-audit.md`)](docs/phase-10-security-audit.md)
- 🚀 [Production Deployment Runbook (`docs/deployment.md`)](docs/deployment.md)

---

## 📜 License

This project is open-source and available under the [ISC License](LICENSE).
