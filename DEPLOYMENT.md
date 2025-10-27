# Deployment Guide

## Overview

ESG Copilot consists of two parts:
- **Frontend** (Next.js) → Deploy to **Netlify** (free tier)
- **Backend** (Node.js/Express) → Deploy to **Render** (free tier)

**Recommended:** Netlify + Render (both have generous free tiers)

---

## 🚀 Deployment Steps

### Prerequisites
- Netlify account (free tier)
- Render account (free tier)
- GitHub repository pushed

---

## Step 1: Deploy Backend on Render

1. **Create Backend Web Service**
   - Go to [render.com](https://render.com)
   - Click **"New +"** → **"Web Service"**
   - Connect your GitHub repository
   - **Name**: `esg-copilot-backend`
   - **Root Directory**: Leave empty (root)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node

2. **Add Environment Variables** (see Backend Environment Variables section below)

3. **Add GCP Service Account Key**
   - Render → Settings → Secret Files
   - **Filename**: `/etc/secrets/gcp-key.json`
   - **Contents**: Paste your GCP service account JSON

4. **Deploy** - Wait ~5 minutes, copy the URL (e.g., `https://esg-copilot-backend.onrender.com`)

---

### Backend Environment Variables

Add these in Render → Environment:

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
FRONTEND_URL=https://esg-copilot-frontend.onrender.com

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

---

## Step 2: Deploy Frontend on Netlify

1. **Push to GitHub** (if not already done)
```bash
git add .
git commit -m "feat: ready for deployment"
git push origin main
```

2. **Deploy to Netlify**
   - Go to [netlify.com](https://netlify.com)
   - Click **"Add new site"** → **"Import an existing project"**
   - Connect your GitHub repository
   - **Base directory**: `frontend`
   - **Build command**: `npm install --legacy-peer-deps && npm run build`
   - **Publish directory**: `frontend/.next`
   - Click **"Deploy site"**
   
   > **Note:** The `--legacy-peer-deps` flag resolves Next.js peer dependency conflicts

3. **Configure Environment Variables**
   - Netlify dashboard → Site settings → Environment variables
   - Click **"Add a variable"** for each:

```
AUTH0_SECRET=<generate-with: openssl rand -hex 32>
AUTH0_BASE_URL=https://your-site-name.netlify.app
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=<from-auth0-dashboard>
AUTH0_CLIENT_SECRET=<from-auth0-dashboard>
AUTH0_AUDIENCE=<your-api-identifier>
NEXT_PUBLIC_API_URL=https://esg-copilot-backend.onrender.com
AUTH0_SCOPE=openid profile email offline_access
```

4. **Redeploy**
   - Site settings → Deploys → **"Trigger deploy"** → **"Deploy site"**

5. **Update Auth0 Callbacks**
   - Go to Auth0 Dashboard → Applications → Your App
   - **Allowed Callback URLs**: `https://your-site-name.netlify.app/api/auth/callback`
   - **Allowed Logout URLs**: `https://your-site-name.netlify.app`
   - **Allowed Web Origins**: `https://your-site-name.netlify.app`

6. **Update Backend CORS** (if needed)
   - Update `FRONTEND_URL` in Render backend env variables to your Netlify URL

---

## 🚀 Option 2: Frontend on Vercel (Alternative)

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

---

## 🎯 Why Netlify + Render?

**Netlify (Frontend):**
- ✅ **Free tier** - 100GB bandwidth, 300 build minutes/month
- ✅ **Fast CDN** - Global edge network
- ✅ **Auto-deploy** - Push to GitHub, auto-deploys
- ✅ **No cold starts** - Always available
- ✅ **Great Next.js support** - Built-in optimization
- ✅ **No credit card** required

**Render (Backend):**
- ✅ **Free tier** - 750 hours/month (1 web service)
- ✅ **Secret files** - Easy GCP service account upload
- ✅ **Environment variables** - Simple UI
- ✅ **Auto-deploy** - Push to GitHub, auto-deploys
- ⚠️ **Cold starts** - Sleeps after 15 min (~30s wake)

**Why Not Both on Render?**
- ❌ Render free tier only allows **1 web service**
- ❌ Would need paid plan ($7/month) for 2nd service

---

## 🔧 Alternative: Backend on Render (if using Vercel for frontend)

If you deployed frontend to Vercel, deploy backend separately:

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

## ⚠️ Important Notes

### Free Tier Limitations

**Vercel Free:**
- ✅ Unlimited deployments
- ✅ Automatic HTTPS
- ⚠️ 100GB bandwidth/month
- ⚠️ Serverless functions timeout: 10s

**Render Free:**
- ✅ 750 hours/month
- ⚠️ Spins down after 15 min inactivity (cold starts ~30s)
- ⚠️ 512MB RAM
- ⚠️ Shared CPU

### Production Recommendations

For production workloads:
1. **Upgrade Render** to Starter ($7/month) - No cold starts
2. **Use Vercel Pro** ($20/month) - Better performance
3. **Enable Redis caching** for RAG queries
4. **Setup monitoring** (Sentry, LogRocket)
5. **Configure CDN** for static assets

---

## 🔍 Verify Deployment

1. **Frontend Health Check**
   - Visit: `https://your-app.vercel.app`
   - Should show login page
   - Login with test account

2. **Backend Health Check**
   - Visit: `https://your-backend.onrender.com/health`
   - Should return: `{"status": "ok"}`

3. **Test Full Flow**
   - Login → Dashboard → Companies
   - Execute an agent (e.g., Research Regulations)
   - Verify data appears correctly

---

## 🐛 Troubleshooting

### Frontend Issues

**"Invalid state" error:**
- Check `AUTH0_BASE_URL` matches your Vercel URL
- Verify Auth0 callback URLs are correct

**API calls fail:**
- Check `NEXT_PUBLIC_API_URL` points to Render backend
- Verify backend is running (not cold start)

### Backend Issues

**"Cannot connect to BigQuery":**
- Verify GCP service account key is uploaded
- Check `GOOGLE_APPLICATION_CREDENTIALS` path

**"FGA Store error":**
- Verify FGA credentials are correct
- Check FGA Store is created in Auth0 dashboard

**Cold start timeout:**
- First request after inactivity takes ~30s
- Upgrade to paid plan to avoid cold starts

---

## 🔄 CI/CD

Both Vercel and Render auto-deploy on git push:

```bash
git add .
git commit -m "feat: add new feature"
git push origin main
# Vercel + Render will auto-deploy
```

---

## 📊 Monitoring

**Vercel:**
- Dashboard → Analytics (page views, errors)
- Logs → Real-time function logs

**Render:**
- Dashboard → Logs (application logs)
- Metrics → CPU, Memory usage

---

## 💰 Cost Estimate

**Free Tier (Development):**
- Netlify: $0
- Render: $0
- Total: **$0/month**

**Production (Recommended):**
- Netlify Pro: $19/month (optional)
- Render Starter: $7/month (no cold starts)
- Total: **$7-26/month**

---

## ✅ Post-Deployment Checklist

- [ ] Backend deployed to Render
- [ ] Frontend deployed to Netlify
- [ ] Backend environment variables configured
- [ ] Frontend environment variables configured
- [ ] GCP service account key uploaded to Render
- [ ] Auth0 callbacks updated with Netlify URL
- [ ] Backend FRONTEND_URL updated to Netlify URL
- [ ] Test accounts work
- [ ] All 5 agents functional
- [ ] Reports generate correctly
- [ ] Chat RAG works
- [ ] Audit logs saving to BigQuery

---

## 🆘 Need Help?

- **Netlify Docs:** https://docs.netlify.com
- **Render Docs:** https://render.com/docs
- **Auth0 Docs:** https://auth0.com/docs
- **Next.js Deployment:** https://nextjs.org/docs/deployment
- **GitHub Issues:** https://github.com/omkardongre/ESG-Copilot/issues
