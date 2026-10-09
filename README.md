# 🏥 MediPriority AI

**AI-Based Hospital Appointment & Patient Priority Management System**

A production-ready, full-stack healthcare SaaS platform with **Google OAuth**, AI-assisted patient prioritization, real-time queue management, role-based dashboards, and enterprise analytics.

---

## ✨ Authentication

MediPriority AI supports two sign-in methods:

| Method | Description |
|--------|-------------|
| **Continue with Google** | Google OAuth 2.0 via Auth.js — one-click sign-in with email verification included |
| **Continue with Email** | Email + password with bcrypt hashing and server-validated sessions |

Google users are automatically registered as **PATIENT**. Hospital teams invite doctors and staff; only the hospital OWNER can invite administrators.

If a user signs in with Google using an email that already exists in the database, the accounts are safely linked — no duplicate accounts.

### Hospital owner registration

Staff sign-in links to `/register-hospital`. The registration wizard collects hospital location and owner details, then emails a one-time 6-digit verification code. The owner and hospital remain pending and cannot sign in until the code is verified. Codes expire after 10 minutes, allow at most five attempts, and pending registrations are removed after 24 hours.

In development, the code is printed to the backend server console only. Production must set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` in `backend/.env.local` (or the deployment environment). SMTP credentials are server-only; never set them in frontend variables.

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| MongoDB | 6+ (local or Atlas) |
| npm | 9+ |

---

### 1. Clone the repository

```bash
git clone https://github.com/Pratik-ally/DocFlow.git
cd DocFlow
```

---

### 2. Configure Google OAuth

#### 2a. Create a Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g. `MediPriority AI`)
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client IDs**
5. Application type: **Web application**

#### 2b. Authorized JavaScript origins

```
http://localhost:3000
https://YOUR-APP.vercel.app
```

#### 2c. Authorized redirect URIs

```
http://localhost:3000/api/auth/callback/google
https://YOUR-APP.vercel.app/api/auth/callback/google
```

6. Copy the **Client ID** and **Client Secret**

---

### 3. Create MongoDB Atlas (production)

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free cluster (M0)
3. Create a database user scoped to `readWrite` on the application database only.
4. Add only the application's known egress IP addresses to the Atlas network access list. If the hosting platform has dynamic egress addresses, use private networking or a static-egress service; do not use `0.0.0.0/0` for production.
5. Copy the TLS-enabled connection string:

```
mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/medipriority?retryWrites=true&w=majority
```

---

### 4. Configure environment variables

#### Frontend (`frontend/.env.local`)

```env
# MongoDB Atlas (or local)
MONGODB_URI=mongodb://localhost:27017/medipriority?replicaSet=rs0

# Auth.js secret — generate with: openssl rand -hex 32
AUTH_SECRET=your_generated_secret_here

# Google OAuth credentials
AUTH_GOOGLE_ID=your_google_client_id
AUTH_GOOGLE_SECRET=your_google_client_secret

# Site URL (REQUIRED for production)
NEXTAUTH_URL=http://localhost:3000

# Express backend URL used by the same-origin Next.js API proxy
NEXT_PUBLIC_API_URL=http://127.0.0.1:5000

# Backend session signing secret — use the same value in backend/.env.local
SESSION_SECRET=your_shared_session_secret_here
```

#### Backend (`backend/.env.local`)

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/medipriority?replicaSet=rs0
SESSION_SECRET=your_shared_session_secret_here
JWT_EXPIRES_IN=7d
NODE_ENV=development
FRONTEND_URL=http://127.0.0.1:3000
DEMO_PASSWORD=
```

---

### 5. Install, migrate and run locally

```bash
# Backend
cd backend
npm install
npm run migrate  # One-time migration when upgrading an existing database
npm run seed     # Optional: resets only the dedicated demo hospital and seeds demo data
npm run dev      # Starts at http://localhost:5000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev      # Starts at http://localhost:3000
```

Copy `backend/.env.example` to `backend/.env.local` and `frontend/.env.example` to `frontend/.env.local` before starting. Set the same `SESSION_SECRET` in both files and set `DEMO_PASSWORD` in `backend/.env.local` to a strong local-only password. `npm run seed` is blocked when `NODE_ENV=production`; it only replaces data belonging to the dedicated demo hospital and the six reserved demo patient accounts, leaving other hospitals and accounts untouched. Never use demo accounts or demo data in a real deployment.

Hospital registration uses MongoDB transactions, so local MongoDB must run as a single-node replica set named `rs0`; add `--replSet rs0` to the local `mongod` command and initiate it once with `mongosh --eval "rs.initiate()"`. The supplied Docker Compose configuration starts and initializes this replica set automatically. Run `npm run migrate` after upgrading an existing database; it preserves pending owners, enables the new indexes, and stops if legacy email duplicates must be resolved before the global unique email index can be created.

For Docker Compose and production backend deployments, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` in the backend environment. The backend refuses to start in production without at least an SMTP host and sender address; SMTP credentials never belong in frontend environment variables.

### Docker Compose

For a local Compose deployment, copy `.env.example` to `.env` and replace every example value with unique secrets before running `docker compose up --build`. The MongoDB root account is reserved for database administration; the application connects with a separate `readWrite` account scoped to the `medipriority` database. Database and application ports bind to loopback for local testing. Use a TLS-terminating reverse proxy and an explicit production domain before exposing the app outside the host. Keep MongoDB passwords alphanumeric so they remain safe in the Compose-generated connection URI.

The backend Docker build excludes local `.env*` files and development artifacts through `backend/.dockerignore`. Pass secrets at runtime; never bake them into an image.

If an earlier Compose configuration was deployed with its built-in session-signing placeholder, replace it with a newly generated `SESSION_SECRET` and redeploy immediately. This invalidates prior sessions. The placeholder is no longer present in this branch's reachable Git history, but rotate any value used in a deployment or distributed image.

---

## Demo accounts and how to try it

The seed script creates a fictional **MediCare General Hospital** with five departments, doctor availability for every day of the week, sample appointments and queue activity.

**Sign-in details:** Use the email in the table as the account ID. Every active demo account uses the same password: the value configured for `DEMO_PASSWORD` in your local `backend/.env.local`. Enter that value itself in the password field; `DEMO_PASSWORD` is only the environment-variable name, not the password. The seeder does not print or store the password in source code. To change it, set a new local `DEMO_PASSWORD` and rerun `npm run seed`.

The removed-doctor account is intentionally disabled and cannot sign in; use it to confirm removed-user access is rejected while past appointments remain in the demo data.

| Role | Email | Portal URL | What to try |
|------|-------|------------|-------------|
| OWNER | `owner@medicare-demo.example.com` | `/staff-login` | Invite an admin, remove an admin, and review the audit log. |
| ADMIN | `admin1@medicare-demo.example.com` | `/staff-login` | Add a doctor and a staff member, remove a team member, and review their upcoming appointments for reassignment. |
| ADMIN | `admin2@medicare-demo.example.com` | `/staff-login` | Explore team and appointment management. |
| DOCTOR — General Medicine | `doctor.general@medicare-demo.example.com` | `/staff-login` | View the priority-sorted queue; start and complete a consultation. |
| DOCTOR — Cardiology | `doctor.cardiology@medicare-demo.example.com` | `/staff-login` | Explore the doctor dashboard and appointments. |
| DOCTOR — Orthopedics | `doctor.orthopedics@medicare-demo.example.com` | `/staff-login` | Explore the doctor dashboard and appointments. |
| DOCTOR — Pediatrics | `doctor.pediatrics@medicare-demo.example.com` | `/staff-login` | Explore the doctor dashboard and appointments. |
| DOCTOR — removed demo account | `doctor.removed@medicare-demo.example.com` | `/staff-login` | Compare removed-account access with retained past appointment history. |
| STAFF — reception | `reception@medicare-demo.example.com` | `/staff-login` | Check in a patient, reorder the queue, and confirm priority. |
| STAFF — nurse | `nurse@medicare-demo.example.com` | `/staff-login` | Explore the staff queue and patient workflows. |
| PATIENT | `patient1@medicare-demo.example.com` | `/login` | Book an appointment, review its AI priority, track queue position, and cancel an appointment. |
| PATIENT | `patient2@medicare-demo.example.com` | `/login` | Explore appointment and queue tracking. |
| PATIENT | `patient3@medicare-demo.example.com` | `/login` | Explore appointment and queue tracking. |
| PATIENT | `patient4@medicare-demo.example.com` | `/login` | Explore appointment and queue tracking. |
| PATIENT | `patient5@medicare-demo.example.com` | `/login` | Explore appointment and queue tracking. |
| PATIENT | `patient6@medicare-demo.example.com` | `/login` | Explore appointment and queue tracking. |

### Walkthroughs

- **Owner:** Sign in at `/staff-login`, invite an admin, remove an admin (confirm with the owner password), then inspect the audit log.
- **Admin:** Add a doctor and a staff member, remove one, and inspect the upcoming appointments returned for reassignment.
- **Doctor:** Open the priority-sorted queue, start a consultation, and mark it complete.
- **Staff:** Check in a patient, change the queue order, and confirm a patient's priority.
- **Patient:** Book an appointment, review the AI-assisted priority, track queue position, then cancel an appointment.

The seed also creates a removed doctor with past appointments, one pending 24-hour invite, sample audit events, notifications, and live queue entries. Login fields are empty by default; no demo credentials are prefilled or shown in any page, banner, tooltip, or placeholder.

> Demo accounts are for local testing only. Delete them and change all passwords before real use.

---

## 🏥 Hospital team API

Staff sessions are checked against the current database user, hospital, account status, and session version on every protected request. Removing a team member immediately invalidates their existing sessions while retaining their historical records.

| Endpoint | Access | Purpose |
|----------|--------|---------|
| `POST /api/staff/login` / `POST /api/staff/logout` | Staff session | Staff-portal sign-in and sign-out |
| `POST /api/team` | OWNER, ADMIN | Invite a DOCTOR or STAFF member |
| `POST /api/team/admins` | OWNER | Invite an ADMIN |
| `GET /api/team` | OWNER, ADMIN | List hospital team with role/status/department filters |
| `PATCH /api/team/:id` | OWNER, ADMIN | Update team member details |
| `POST /api/team/:id/remove` / `POST /api/team/:id/reactivate` | OWNER, ADMIN | Revoke or restore team access |
| `POST /api/invites/accept` | Public, rate limited | Accept an unexpired, one-time invite and set a password |
| `GET /api/hospital` | Public | Return hospital name and logo for login pages |
| `GET /api/health` | Public | API health status |

Invite creation returns a one-time token for delivery to the invited person. Store/deliver that token securely; only its hash is saved in MongoDB. Invite acceptance tokens expire after 24 hours. An email delivery provider is not configured by this API.

---

## 🏗️ Website Architecture

MediPriority is a full-stack web application. The Next.js frontend serves the patient, doctor, staff, and admin portals; Auth.js handles web sign-in; and an Express API owns the operational hospital workflows and persists them to MongoDB.

```text
┌────────────────────────────────────────────────────────────────────┐
│ Browser                                                            │
│ Patient portal │ Doctor portal │ Staff portal │ Admin portal       │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ HTTPS, same-origin requests
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│ Next.js application (frontend/)                                    │
│ React pages/components │ Middleware │ Auth.js routes               │
│ /api/auth/*             │ /api/auth/session-bridge                 │
│ /backend-api/* ─────────┼───────────────┐                           │
└─────────────────────────┼───────────────┼──────────────────────────┘
                          │               │
                          │               └──────────────┐
                          ▼                              ▼
┌──────────────────────────────────┐    ┌────────────────────────────┐
│ Express API (backend/)           │    │ MongoDB                    │
│ Routes → middleware → controllers│    │ Auth.js users/accounts     │
│                                  │    │ Hospitals, teams, patients,│
│ Appointments │ Team │ Invites    │    │ appointments, queues,      │
│ Queue │ AI priority │ Admin      │    │ invites, audits, notices   │
│ Auth/session and audit services  │    └──────────────┬─────────────┘
└───────────────────┬──────────────┘                   │
                    └───────────────────────────────────┘
                              Mongoose

External identity provider: Google OAuth ──► Auth.js
```

### Request and session flow

1. A visitor signs in using Auth.js credentials or Google OAuth. Auth.js stores OAuth account/session data in MongoDB.
2. After sign-in, the session bridge reloads the account from MongoDB and issues a short-lived, HTTP-only backend JWT cookie for the correct portal.
3. Browser API calls use the same-origin `/backend-api/*` path. The Next.js rewrite forwards them to Express `/api/*` endpoints, keeping backend cookies available to the browser.
4. Express authentication middleware validates the session against the current database user, including active status, hospital, role, and session version. Controllers then perform hospital-scoped operations and write operational records to MongoDB.
5. Appointment workflows use the backend priority engine; if priority assessment fails, booking continues as `ROUTINE` and is flagged for staff and doctor manual review. Queue, team, invite, and audit workflows are handled by their corresponding backend routes and services.

### Main code areas

| Area | Responsibility |
|------|----------------|
| `frontend/app/` | Portal pages, dashboards, and Next.js authentication routes |
| `frontend/components/` | Shared interface components and layouts |
| `frontend/services/api.ts` | Same-origin Express API client and session refresh |
| `backend/src/routes/` | HTTP endpoint registration and access rules |
| `backend/src/controllers/` | Request validation and hospital workflow handlers |
| `backend/src/middleware/` | Authentication, authorization, rate limits, and error handling |
| `backend/src/models/` | MongoDB schemas and indexes |
| `backend/src/ai/priorityEngine.ts` | Demonstration appointment-priority assessment |

The deployment topology is described in [Vercel Deployment](#-vercel-deployment).

## 🌐 Vercel Deployment

### Architecture on Vercel

```
        INTERNET
            │
            ▼
          VERCEL
            │
   ┌────────┴────────┐
   ▼                 ▼
Next.js           API Routes
Website         (/api/auth/*)
   │                 │
   └────────┬────────┘
            ▼
      Auth.js (v5)
            │
   ┌────────┴────────┐
   ▼                 ▼
Google OAuth      MongoDB Atlas
(credentials)
```

### Deploy steps

#### Step 1: Push to GitHub

```bash
# Commit changes in the existing repository
git add .
git commit -m "Update MediPriority"
git push -u origin main
```

#### Step 2: Import to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repository
3. Set **Root Directory** to `frontend`
4. Framework preset: **Next.js** (auto-detected)
5. Click **Deploy**

#### Step 3: Add Vercel environment variables

In your Vercel project → **Settings → Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `MONGODB_URI` | Your MongoDB Atlas connection string |
| `AUTH_SECRET` | `openssl rand -hex 32` output |
| `AUTH_GOOGLE_ID` | Your Google OAuth Client ID |
| `AUTH_GOOGLE_SECRET` | Your Google OAuth Client Secret |
| `NEXTAUTH_URL` | `https://YOUR-APP.vercel.app` |
| `SESSION_SECRET` | Must exactly match the backend `SESSION_SECRET` and contain at least 32 characters in production |
| `NEXT_PUBLIC_API_URL` | URL of your deployed Express backend (if separate) |

#### Step 4: Update Google OAuth redirect URI

After getting your Vercel URL, add to Google Cloud Console:

```
https://YOUR-APP.vercel.app/api/auth/callback/google
```

#### Step 5: Redeploy

Trigger a redeploy from Vercel dashboard after updating environment variables.

---

### Express Backend on Vercel (optional)

The Express backend can be deployed separately (Railway, Render, Fly.io) or as a Vercel serverless function.

For a simple setup, put the backend on [Railway](https://railway.app):

```bash
cd backend
railway init
railway up
```

Then set `NEXT_PUBLIC_API_URL` in Vercel to your Railway URL.

---

## 📁 Project Structure

```
medipriority/
├── frontend/                    Next.js 14 application
│   ├── app/
│   │   ├── api/
│   │   │   └── auth/
│   │   │       ├── [...nextauth]/route.ts   Auth.js handler
│   │   │       └── session-bridge/route.ts  Express JWT bridge
│   │   ├── login/               Login page (Google + Email)
│   │   ├── register/            Patient registration
│   │   ├── error/               OAuth error page
│   │   ├── unauthorized/        Access denied page
│   │   ├── not-found.tsx        404 page
│   │   ├── patient/             Patient portal
│   │   ├── doctor/              Doctor portal
│   │   ├── staff/               Staff portal
│   │   └── admin/               Admin portal
│   ├── auth.ts                  Auth.js configuration
│   ├── middleware.ts            Route protection (Auth.js session)
│   └── types/next-auth.d.ts    Session type augmentations
│
├── backend/                     Express.js API
│   ├── src/
│   │   ├── ai/priorityEngine.ts  Rule-based AI engine
│   │   ├── controllers/
│   │   ├── models/              Mongoose models, including Hospital, Invite and AuditLog
│   │   ├── routes/
│   │   └── seed/index.ts        Demo data seeder
│   └── Dockerfile
│
├── docker-compose.yml
├── README.md
├── .gitignore
└── README.md
```

---

## 🔐 Google OAuth Flow

```
User clicks "Continue with Google"
          │
          ▼
Google OAuth Consent Screen
          │
          ▼
Callback: /api/auth/callback/google
          │
          ▼
Auth.js signIn() callback
          │
     ┌────┴────┐
     ▼         ▼
  Email       Email
 exists?    not found
     │         │
     ▼         ▼
Link to     Create new
existing    user record
 account   (role=PATIENT)
     │         │
     └────┬────┘
          ▼
JWT session token minted
          │
          ▼
session-bridge → sets Express JWT cookie
          │
          ▼
Redirect to /patient/dashboard
```

---

## 🤖 AI Priority Engine

`frontend/../backend/src/ai/priorityEngine.ts`

Rule-based demonstration engine. To replace with an ML model, implement the same function signature:

```typescript
function assessPriority(input: PriorityInput): PriorityResult
```

> **Disclaimer:** Does not provide medical diagnosis. All assessments require human review.

---

## 🔒 Security

| Feature | Implementation |
|---------|----------------|
| Google OAuth | Auth.js v5 + Google provider |
| Password hashing | bcrypt (12 rounds) |
| Session tokens | JWT embedded in Auth.js |
| HTTP-only cookies | Auth.js session + Express bridge |
| CSRF protection | Auth.js built-in |
| Email verification | Provided by Google OAuth |
| Rate limiting | express-rate-limit (100/15min) |
| Secure headers | Helmet.js |
| Input validation | Zod |
| Role protection | Auth.js middleware + RBAC |
| Audit logging | MongoDB AuditLog collection |
| Secrets | Environment variables only |

---

## 🗄️ MongoDB Collections

| Collection | Purpose |
|-----------|---------|
| `users` | All users (Auth.js adapter collection) |
| `accounts` | OAuth account links (Auth.js) |
| `sessions` | (Not used — JWT strategy) |
| `patients` | Patient medical profiles |
| `doctors` | Doctor profiles and availability |
| `hospitals` | Hospital metadata |
| `departments` | Hospital departments |
| `appointments` | All appointment records |
| `queueentries` | Live queue positions |
| `priorityassessments` | AI assessment records |
| `notifications` | User notifications |
| `auditlogs` | Security audit trail |

---

## 📜 License

This is a demonstration project. Not for clinical use.

---

*Built as a polished, professional healthcare SaaS platform.*
