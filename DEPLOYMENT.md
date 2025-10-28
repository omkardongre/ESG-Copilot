# Deployment Guide

## Overview

ESG Copilot consists of two parts:

- **Frontend** (Next.js) → Deploy to **Vercel**
- **Backend** (Node.js/Express) → Deploy to **Render**

---

## 🚀 Frontend Deployment (Vercel)

### Prerequisites

- Vercel account (free tier works)
- GitHub repository pushed

### Steps

1. **Push to GitHub**

```bash
git add .
git commit -m "feat: production-ready deployment"
git push origin main
```

2. **Deploy to Vercel**

   - Go to [vercel.com](https://vercel.com)
   - Click **"Add New Project"**
   - Import your GitHub repository
   - **Root Directory**: `frontend`
   - **Framework Preset**: Next.js
   - Click **"Deploy"**

3. **Configure Environment Variables**

In Vercel dashboard → Settings → Environment Variables, add:

```
AUTH0_SECRET=<generate-with: openssl rand -hex 32>
AUTH0_BASE_URL=https://your-app.vercel.app
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=<from-auth0-dashboard>
AUTH0_CLIENT_SECRET=<from-auth0-dashboard>
AUTH0_AUDIENCE=<your-api-identifier>
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

4. **Update Auth0 Callbacks**

   - Go to Auth0 Dashboard → Applications → Your App
   - **Allowed Callback URLs**: `https://your-app.vercel.app/api/auth/callback`
   - **Allowed Logout URLs**: `https://your-app.vercel.app`
   - **Allowed Web Origins**: `https://your-app.vercel.app`

5. **Redeploy**
   - Vercel will auto-deploy on git push
   - Or manually trigger from Vercel dashboard

---

## 🖥️ Backend Deployment (Render)

### Prerequisites

- Render account (free tier available)
- GitHub repository pushed

### Steps

1. **Create Web Service**

   - Go to [render.com](https://render.com)
   - Click **"New +"** → **"Web Service"**
   - Connect your GitHub repository
   - **Root Directory**: Leave empty (root)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node

2. **Configure Environment Variables**

In Render dashboard → Environment, add all from `.env`:

```
# Auth0
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=<client-id>
AUTH0_CLIENT_SECRET=<client-secret>
AUTH0_API_IDENTIFIER=<api-identifier>
AUTH0_AUDIENCE=<api-identifier>

# Google Cloud
GOOGLE_CLOUD_PROJECT=<project-id>
GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/gcp-key.json
DATASET_ID=<dataset-name>
CLOUD_PROJECT_REGION=us-central1

# Gemini AI
GOOGLE_API_KEY=<gemini-api-key>
MODEL=gemini-2.5-flash
TEMPERATURE=0.2
TOP_P=0.95
TOP_K=40

# SendGrid
SENDGRID_FROM_EMAIL=<verified-sender-email>
FRONTEND_URL=https://your-app.vercel.app

# Climatiq
CLIMATIQ_API_KEY=<climatiq-key>

# Pinecone
PINECONE_API_KEY=<pinecone-key>

# Auth0 FGA Store
FGA_API_URL=https://api.us1.fga.dev
FGA_STORE_ID=<store-id>
FGA_MODEL_ID=<model-id>
FGA_API_TOKEN_ISSUER=fga.us.auth0.com
FGA_API_AUDIENCE=https://api.us1.fga.dev/
FGA_CLIENT_ID=<fga-client-id>
FGA_CLIENT_SECRET=<fga-client-secret>

# Report Config
MAX_REVIEW_ITERATIONS=1
REPORT_REFINEMENT_ITERATIONS=1
```

3. **Add Google Cloud Service Account Key**

   - Render → Settings → Secret Files
   - **Filename**: `/etc/secrets/gcp-key.json`
   - **Contents**: Paste your GCP service account JSON

4. **Deploy**

   - Click **"Create Web Service"**
   - Wait for build to complete (~5 minutes)
   - Copy the Render URL (e.g., `https://esg-copilot.onrender.com`)

5. **Update Frontend**
   - Go back to Vercel
   - Update `NEXT_PUBLIC_API_URL` to your Render URL
   - Redeploy frontend

---