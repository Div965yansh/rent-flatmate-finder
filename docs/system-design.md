# System Design Document — Rent & Flatmate Finder

> **Status:** Phase 1 Placeholder (Scaffolding & Foundation)  
> **Last Updated:** October 2026

---

## 1. Executive Overview

**Rent & Flatmate Finder** is a web platform designed to streamline rental discovery and roommate matching. The platform connects property owners with prospective tenants and enables flatmates to find compatible co-living partners using lifestyle preferences and automated compatibility scoring.

---

## 2. High-Level Architecture

```
[ Client Application (React + Vite + Tailwind) ]
                     │  ▲
        HTTP / REST  │  │  WebSocket (Socket.io)
                     ▼  │
 [ Express.js API Gateway & Controllers ]
         │                │
         ▼                ▼
 [ Prisma ORM ]    [ Socket.io Server ]
         │
         ▼
[ PostgreSQL Database ]
```

---

## 3. Technology Stack

### Frontend
- **Framework:** React 19 (Vite)
- **Routing:** React Router v7
- **Styling:** Tailwind CSS v4
- **HTTP Client:** Axios
- **Real-Time Client:** Socket.io-client

### Backend
- **Runtime:** Node.js (ES Modules)
- **Web Framework:** Express 5
- **Database & ORM:** PostgreSQL + Prisma ORM
- **Authentication & Security:** bcrypt, jsonwebtoken (JWT), cors
- **Validation:** Zod
- **Real-Time:** Socket.io
- **Configuration:** dotenv

---

## 4. Phased Implementation Roadmap

- [x] **Phase 1: Project Initialization & Scaffolding**
  - Repository structure setup
  - Backend Express server & health endpoint (`GET /api/health`)
  - Frontend Vite + React + Tailwind + React Router scaffolding
  - Environment variable templates & root `.gitignore`
  - Clean directory architecture for future modules

- [ ] **Phase 2: Database Schema & Authentication**
  - Prisma schema definition (Users, Profiles, Properties, Matches, Messages)
  - User registration, login, JWT issuance, and authentication middleware
  - Password hashing with bcrypt and input validation with Zod

- [ ] **Phase 3: Property Listings & Search Management**
  - Owner listing creation, updating, and media uploads (Cloudinary)
  - Filtering by location, budget, room type, and amenities
  - Tenant profile preferences configuration

- [ ] **Phase 4: Compatibility Engine & Inquiries**
  - Lifestyle compatibility scoring algorithms
  - Expression of Interest (EOI) workflow (Inbox / Actions)
  - Notification hooks

- [ ] **Phase 5: Real-Time Communication & Chat**
  - Socket.io live messaging and presence tracking
  - Message persistence and delivery receipts

- [ ] **Phase 6: Admin Dashboard, Moderation & Polish**
  - Verification audit log, listing moderation, and reporting
  - Performance optimization, indexing, and end-to-end security audit
