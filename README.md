# ESG Copilot

**AI-powered ESG compliance automation platform with enterprise-grade security**

ESG Copilot helps small and medium businesses automate sustainability reporting by using AI agents to research regulations, collect ESG data, calculate emissions, and generate compliance reports (GRI, SASB, TCFD).

## 🚀 Key Features

### **5 AI Agents**
- **Regulation Research Agent** - Identifies applicable ESG frameworks and deadlines
- **ESG Data Collection Agent** - Gathers environmental, social, and governance metrics
- **Emissions Calculator Agent** - Calculates Scope 1, 2, 3 carbon footprint via Climatiq API
- **Report Generator Agent** - Creates GRI/SASB/TCFD reports with iterative refinement
- **Chat Agent** - Permission-aware RAG for company-specific ESG queries

### **Auth0 Security Integration**
- ✅ **Universal Login** - Secure authentication with JWT tokens
- ✅ **Token Vault** - API keys (Climatiq, SendGrid, Pinecone) injected into JWT for authorized users only
- ✅ **FGA Store** - Fine-grained document-level authorization with company data isolation
- ✅ **Role-Based Access** - 4 roles (Company Admin, ESG Consultant, Auditor, Regulator)
- ✅ **Audit Logging** - Complete action history in BigQuery

### **Data Isolation**
- Company Admins see only their own company data
- ESG Consultants access all companies
- Auditors and Regulators have read-only access
- Zero knowledge leakage between companies

## 🛠️ Tech Stack

**Frontend:** Next.js 14, Auth0 Next.js SDK, TailwindCSS  
**Backend:** Node.js, Express, LangChain.js, Google Gemini 2.5 Flash  
**Data:** BigQuery (audit logs, ESG data), Pinecone (RAG vector DB), Auth0 FGA Store  
**APIs:** Climatiq (emissions), SendGrid (email), Pinecone (vector search)

## 📦 Installation

### Prerequisites
- Node.js 18+
- Google Cloud account (BigQuery)
- Auth0 account
- Pinecone account
- Climatiq API key
- SendGrid API key

### Setup

1. **Clone repository**
```bash
git clone https://github.com/omkardongre/ESG-Copilot.git
cd ESG-Copilot
```

2. **Install dependencies**
```bash
npm install
cd frontend && npm install && cd ..
```

3. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. **Setup BigQuery**
- Create dataset in Google Cloud
- Run schema from `docs/EXTERNAL_SERVICES_SETUP.md`

5. **Setup Auth0**
- Create Auth0 application
- Configure roles, permissions, and Token Vault action
- Setup FGA Store authorization model
- See `docs/EXTERNAL_SERVICES_SETUP.md` for details

6. **Start services**
```bash
# Terminal 1: Backend
npm start

# Terminal 2: Frontend
cd frontend && npm run dev
```

7. **Access application**
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## 🔐 Test Accounts

| Email | Password | Role | Access |
|-------|----------|------|--------|
| `tesla@company.com` | `Test@1234` | Company Admin | Own company only |
| `patagonia@company.com` | `Test@1234` | Company Admin | Own company only |
| `consultant@esgfirm.com` | `Test@1234` | ESG Consultant | All companies |
| `auditor@sustainapilot.com` | `Test@1234` | Auditor | Read-only |
| `regulator@epa.gov` | `Test@1234` | Regulator | Read-only |



## 🤝 Contributing

This is a demonstration project. For production use, please review security configurations and scale infrastructure accordingly.

## 📄 License

MIT License - See LICENSE file for details

## 🔗 Links

- **GitHub:** https://github.com/omkardongre/ESG-Copilot
- **Auth0 for AI Agents:** https://auth0.com/ai-agents
