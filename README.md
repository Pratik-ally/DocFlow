# 🏥 MediPriority AI

**AI-Based Hospital Appointment & Patient Priority Management System**

A production-ready, full-stack healthcare SaaS platform with **Google OAuth**, AI-assisted patient prioritization, real-time queue management, role-based dashboards, and enterprise analytics.

---

## ✨ Authentication

MediPriority AI supports two sign-in methods:

| Method | Description |
|--------|-------------|
| **Continue with Google** | Google OAuth 2.0 via Auth.js — one-click sign-in with email verification included |
| **Continue with Email** | Email + password with bcrypt hashing, secure JWT cookies |

Google users are automatically registered as **PATIENT**. Roles (DOCTOR, STAFF, ADMIN) are assigned by an administrator.

If a user signs in with Google using an email that already exists in the database, the accounts are safely linked — no duplicate accounts.

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
git clone https://github.com/YOUR_USERNAME/medipriority.git
cd medipriority
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
3. Create a database user with read/write access
4. Add your IP address (or `0.0.0.0/0` for Vercel)
5. Copy the connection string:

```
mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/medipriority?retryWrites=true&w=majority
```

---

### 4. Configure environment variables

#### Frontend (`frontend/.env.local`)

```env
# MongoDB Atlas (or local)
MONGODB_URI=mongodb://localhost:27017/medipriority

# Auth.js secret — generate with: openssl rand -hex 32
AUTH_SECRET=your_generated_secret_here

# Google OAuth credentials
AUTH_GOOGLE_ID=your_google_client_id
AUTH_GOOGLE_SECRET=your_google_client_secret

# Site URL (REQUIRED for production)
NEXTAUTH_URL=http://localhost:3000

# Express backend URL used by the same-origin Next.js API proxy
NEXT_PUBLIC_API_URL=http://127.0.0.1:5000

# Express JWT secret — set the exact same value in frontend and backend
JWT_SECRET=your_shared_jwt_secret_here
```

#### Backend (`backend/.env.local`)

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/medipriority
JWT_SECRET=your_shared_jwt_secret_here
JWT_EXPIRES_IN=7d
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

---

### 5. Install and run locally

```bash
# Backend
cd backend
npm install
npm run seed     # Seed demo data into MongoDB
npm run dev      # Starts at http://localhost:5000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev      # Starts at http://localhost:3000
```

---

## 🔑 Demo Login Credentials

> ⚠️ These are fictional development accounts seeded by `npm run seed`.

| Role | Email | Password |
|------|-------|----------|
| **Patient** | patient@demo.com | Demo@123 |
| **Doctor** | doctor@demo.com | Demo@123 |
| **Staff** | staff@demo.com | Demo@123 |
| **Admin** | admin@demo.com | Demo@123 |

All four accounts are displayed on the `/login` page for easy access.

---

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
# Rename gitignore.txt to .gitignore before committing
mv gitignore.txt .gitignore

git init
git add .
git commit -m "Initial commit: MediPriority AI"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/medipriority.git
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
| `JWT_SECRET` | Must exactly match the backend `JWT_SECRET` and contain at least 32 characters in production |
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
│   │   ├── models/              10 Mongoose models
│   │   ├── routes/
│   │   └── seed/index.ts        Demo data seeder
│   └── Dockerfile
│
├── docker-compose.yml
├── README.md
└── gitignore.txt                Rename to .gitignore
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
