# ESG Copilot Frontend

Next.js frontend with Auth0 Universal Login integration.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure Auth0:
```bash
cp .env.local.template .env.local
# Edit .env.local with your Auth0 credentials
```

3. Run development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Auth0 Configuration

1. Create an Auth0 Application (Regular Web Application)
2. Set Allowed Callback URLs: `http://localhost:3000/api/auth/callback`
3. Set Allowed Logout URLs: `http://localhost:3000`
4. Copy credentials to `.env.local`

## Features

- 🔐 Auth0 Universal Login
- 🎨 Tailwind CSS styling
- 📊 Dashboard with 4 sections
- 🤖 AI agent demonstrations
- 🔑 Token Vault integration showcase
