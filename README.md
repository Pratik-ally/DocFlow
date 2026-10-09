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



## Demo accounts and how to try it

The seed script creates a fictional **MediCare General Hospital** with five departments, doctor availability for every day of the week, sample appointments and queue activity.

**Sign-in details:** Use the email in the table as the account ID. Every active demo account uses the same password: the value configured for `DEMO_PASSWORD` in your local `backend/.env.local`. Enter that value itself in the password field; `DEMO_PASSWORD` is only the environment-variable name, not the password. The seeder does not print or store the password in source code. To change it, set a new local `DEMO_PASSWORD` and rerun `npm run seed`.

The removed-doctor account is intentionally disabled and cannot sign in; use it to confirm removed-user access is rejected while past appointments remain in the demo data.

| Role | Email | Password  | What to try |
|------|-------|------------|-------------|
| OWNER | `owner@medicare-demo.example.com` | `6a59f9dd69048d15a90f95362257c9abc0ba` | Invite an admin, remove an admin, and review the audit log. |
| ADMIN | `admin1@medicare-demo.example.com` | `` | Add a doctor and a staff member, remove a team member, and review their upcoming appointments for reassignment. |
| ADMIN | `admin2@medicare-demo.example.com` | `` | Explore team and appointment management. |
| DOCTOR — General Medicine | `doctor.general@medicare-demo.example.com` | `` | View the priority-sorted queue; start and complete a consultation. |
| DOCTOR — Cardiology | `doctor.cardiology@medicare-demo.example.com` | `` | Explore the doctor dashboard and appointments. |
| DOCTOR — Orthopedics | `doctor.orthopedics@medicare-demo.example.com` | `` | Explore the doctor dashboard and appointments. |
| DOCTOR — Pediatrics | `doctor.pediatrics@medicare-demo.example.com` | `` | Explore the doctor dashboard and appointments. |
| DOCTOR — removed demo account | `doctor.removed@medicare-demo.example.com` | `` | Compare removed-account access with retained past appointment history. |
| STAFF — reception | `reception@medicare-demo.example.com` | `` | Check in a patient, reorder the queue, and confirm priority. |
| STAFF — nurse | `nurse@medicare-demo.example.com` | `` | Explore the staff queue and patient workflows. |
| PATIENT | `patient1@medicare-demo.example.com` | `` | Book an appointment, review its AI priority, track queue position, and cancel an appointment. |
| PATIENT | `patient2@medicare-demo.example.com` | `` | Explore appointment and queue tracking. |
| PATIENT | `patient3@medicare-demo.example.com` | `` | Explore appointment and queue tracking. |
| PATIENT | `patient4@medicare-demo.example.com` | `` | Explore appointment and queue tracking. |
| PATIENT | `patient5@medicare-demo.example.com` | `` | Explore appointment and queue tracking. |
| PATIENT | `patient6@medicare-demo.example.com` | `` | Explore appointment and queue tracking. |

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

### Architecture

```
Browser
  │
  ├── Vercel: Next.js site + Auth.js routes
  │       └── /backend-api/* rewrite ──────────┐
  │                                            │ HTTPS
  ├── Google OAuth (optional)                   ▼
  │                                  Node host: Express API
  │                                  (Railway, Render, etc.)
  │                                            │
  └────────────────────────────────────────────┤
                                               ├── MongoDB Atlas
                                               └── SMTP provider
```

Deploy the Next.js frontend and Express backend as separate services. The browser sends API requests to the frontend's same-origin `/backend-api/*` path, and Next.js forwards them to the public backend URL. Vercel does not run the Express backend from this repository.

### Step-by-step deployment

#### 1. Prepare GitHub

Push the code you want to deploy to the GitHub branch you will use (normally `main`) and connect that repository to Vercel and your backend host. Never commit `.env`, `.env.local`, database credentials, OAuth secrets, or SMTP credentials. Enter production secrets only in the hosting providers' environment settings.

#### 2. Create MongoDB Atlas database

1. Create an Atlas project and cluster.
2. Create a dedicated database user with a strong password and only the database access DocFlow needs.
3. In Atlas **Network Access**, allow connections from the backend host's outbound IP addresses. If the host cannot provide stable egress IPs, use its private networking guidance; avoid `0.0.0.0/0` when possible.
4. Copy the Atlas connection string, set the database name to `medipriority`, and replace the username/password placeholders. URL-encode special characters in the credentials.
5. Keep the URI private. The backend and frontend both need it.

Atlas supports the replica-set transactions used for owner registration. A standalone local MongoDB server does not; use the Docker Compose replica set for local development.

#### 3. Create the Vercel project and obtain its URL

1. In [Vercel](https://vercel.com), select **Add New → Project** and import the GitHub repository.
2. Set **Root Directory** to `frontend`. Keep the **Next.js** framework preset and default build command (`npm run build`).
3. Deploy once to create the Vercel project and production domain, for example `https://your-app.vercel.app`. The site is not fully configured until the backend URL and production environment variables are added below.

#### 4. Deploy the Express backend

Create a Node.js web service on a host such as [Railway](https://railway.app) or [Render](https://render.com), connected to the same GitHub repository. Configure it as follows:

| Setting | Value |
|---------|-------|
| Root / working directory | `backend` |
| Build command | `npm install && npm run build` |
| Start command | `npm start` |
| Health-check path (if supported) | `/api/health` |

Add these variables to the backend service's environment settings:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `PORT` | Use the port supplied by the hosting platform; it should set `PORT` automatically. |
| `MONGODB_URI` | Private Atlas URI from step 2, including the `medipriority` database. |
| `SESSION_SECRET` | A unique random secret at least 32 characters long. You will enter the exact same value in Vercel. |
| `FRONTEND_URL` | Exact Vercel production origin, such as `https://your-app.vercel.app`, with no trailing slash. |
| `SMTP_HOST` | Hostname supplied by your SMTP provider. Required for the backend to start in production. |
| `SMTP_PORT` | SMTP port supplied by your provider (commonly `587`). |
| `SMTP_USER` | SMTP username supplied by your provider. |
| `SMTP_PASSWORD` | SMTP password or API credential supplied by your provider. |
| `SMTP_FROM` | Verified sender address, for example `DocFlow <noreply@your-domain.example>`. Required for the backend to start in production. |

SMTP is needed to deliver owner email-verification codes. Verify the sender/domain with your provider. Keep SMTP values on the backend only; never expose them through `NEXT_PUBLIC_*` variables.

Wait for the backend host to report the service healthy. Check `https://YOUR-BACKEND-HOST/api/health` and confirm it returns a successful health response. Copy the backend's public base URL (origin only, with no `/api` suffix or trailing slash) for the next step.

#### 5. Configure Vercel production environment variables

In Vercel, open **Project → Settings → Environment Variables** and add these for the **Production** environment:

| Variable | Value |
|----------|-------|
| `MONGODB_URI` | The same private Atlas URI used by the backend. |
| `SESSION_SECRET` | Exactly the same value as the backend's `SESSION_SECRET`. |
| `AUTH_SECRET` | A separate random secret for Auth.js. Do not reuse `SESSION_SECRET`. |
| `NEXTAUTH_URL` | Exact production site URL, such as `https://your-app.vercel.app`. |
| `NEXT_PUBLIC_API_URL` | Backend public base URL from step 4, such as `https://your-backend.example.com`, with no trailing slash. This value is used when Next.js builds. |

Generate each secret independently on your computer with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run the command separately for `SESSION_SECRET` and `AUTH_SECRET`. Do not commit or share the generated values.

`AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are needed only if you enable Google sign-in; configure them in step 6. `SERVER_ACTIONS_ALLOWED_ORIGINS` is normally unnecessary for a direct Vercel deployment; only set it when a trusted reverse proxy requires additional origins.

If you use Vercel Preview deployments, configure separate test credentials and a separate test database in the **Preview** scope. Do not connect previews to production data by default.

#### 6. Configure Google sign-in (optional)

1. In [Google Cloud Console](https://console.cloud.google.com/), configure the OAuth consent screen. Add test users if the application remains in testing mode.
2. Create an OAuth client with application type **Web application**.
3. Add the Vercel production origin to **Authorized JavaScript origins**:
   `https://your-app.vercel.app`
4. Add this exact URL to **Authorized redirect URIs**:
   `https://your-app.vercel.app/api/auth/callback/google`
5. Add `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` to Vercel's **Production** environment, then redeploy.

For a custom domain, add it to Vercel first. Then use that same domain consistently in `NEXTAUTH_URL`, `FRONTEND_URL`, the Google authorized JavaScript origin, and the Google callback URI.

#### 7. Redeploy and verify

1. Redeploy the production branch in Vercel so the configured values—especially `NEXT_PUBLIC_API_URL`—are applied during the build.
2. Open the Vercel site and check that the login and registration pages load.
3. Check `https://YOUR-VERCEL-DOMAIN/backend-api/health`. The Next.js proxy should return the backend health response. Also check `https://YOUR-BACKEND-HOST/api/health` directly.
4. Test owner registration and email verification, then sign in and try a basic hospital workflow. Review Vercel and backend logs if something fails; do not share logs containing credentials or verification codes.
5. Confirm Atlas accepts connections only from the intended backend and that production secrets are stored only in provider settings.

For an existing production database, back it up and follow the migration instructions in the local setup section before deploying schema changes. Do not run the demo seed script against production; it is intended for local demo data only.

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
