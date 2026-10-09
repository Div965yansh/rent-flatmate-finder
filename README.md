# Rent & Flatmate Finder 🏠✨

An AI-powered rental and roommate discovery platform built to connect property owners with prospective tenants and match compatible flatmates.

---

## 🌟 Project Overview

Rent & Flatmate Finder simplifies the process of finding rooms, apartments, and compatible flatmates. By combining structured property listings with lifestyle profiling and real-time messaging, the platform streamlines the entire search-to-lease journey.

---

## 🛠️ Tech Stack

### Frontend
- **React 19** with **Vite** — Fast, modern client application
- **React Router** — Client-side navigation & route management
- **Tailwind CSS v4** — Utility-first styling & responsive layouts
- **Axios** — API communication
- **Socket.io-client** — Real-time event subscription

### Backend
- **Node.js & Express 5** — RESTful API services (ES Modules)
- **Prisma & PostgreSQL** — Type-safe database ORM and relational storage
- **bcrypt & jsonwebtoken** — Password hashing and token-based authentication
- **Zod** — Schema declaration and runtime validation
- **cors & dotenv** — Cross-Origin Resource Sharing and environment management
- **Socket.io** — Real-time bidirectional WebSocket communication

---

## 📌 Current Status: Phase 1 (Scaffolding & Foundation)

Phase 1 establishes the clean project architecture, workspace configurations, baseline dependencies, and initial server endpoints:

- [x] Initialized Node.js backend with Express, Prisma, and security libraries.
- [x] Implemented `/api/health` endpoint with dynamic CORS and port configuration.
- [x] Initialized Vite + React + Tailwind CSS frontend application.
- [x] Configured React Router with modular placeholder pages:
  - Login (`/login`)
  - Register (`/register`)
  - Owner Dashboard (`/owner/dashboard`)
  - Listing Form (`/listings/new`)
  - Tenant Profile (`/profile`)
  - Search / Discovery (`/search`)
  - Interest Inbox (`/inbox`)
  - Real-time Chat (`/chat`)
  - Admin Control Center (`/admin`)
- [x] Configured root `.gitignore` and `.env.example` templates for both tiers.
- [x] Set up placeholder system design document (`docs/system-design.md`).

---

## 🚀 Local Setup & Running Commands

### 1. Prerequisites
- **Node.js** (v18+ or v20+ recommended)
- **npm** (v9+)
- **Git**

### 2. Clone and Setup Environment Variables

```bash
# Clone the repository
git clone <repo-url>
cd rent-flatmate-finder

# Configure Backend environment variables
cp backend/.env.example backend/.env

# Configure Frontend environment variables
cp frontend/.env.example frontend/.env
```

### 3. Backend Setup

```bash
cd backend
npm install
npm run dev
```

The backend server starts on `http://localhost:5000`.  
Verify health by visiting or pinging:
```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "rent-flatmate-finder-backend"
}
```

### 4. Frontend Setup

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend application will be live at:
```
http://localhost:5173
```

---

## 📂 Project Structure

```
rent-flatmate-finder/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   │   ├── health.routes.js
│   │   │   └── index.js
│   │   ├── services/
│   │   ├── app.js
│   │   └── server.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── Footer.jsx
│   │   │   └── PlaceholderCard.jsx
│   │   ├── pages/
│   │   │   ├── AdminPage.jsx
│   │   │   ├── ChatPage.jsx
│   │   │   ├── InterestInboxPage.jsx
│   │   │   ├── ListingFormPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── NotFoundPage.jsx
│   │   │   ├── OwnerDashboardPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── SearchPage.jsx
│   │   │   └── TenantProfilePage.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── docs/
│   └── system-design.md
├── .gitignore
└── README.md
```

---

## 🔜 Next Steps: Phase 2
- PostgreSQL database setup and Prisma schema migrations
- User model, authentication routes, and password encryption
- JWT middleware and role-based access validation
