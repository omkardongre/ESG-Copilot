// ESG Copilot - Main Server
const express = require('express');
const config = require('./config');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS - Allow frontend access
app.use((req, res, next) => {
  const allowedOrigins = ['http://localhost:3000', 'https://esg-copilot.vercel.app'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'ESG Copilot API' });
});

// Routes
app.use('/api/agents', require('./routes/agents'));
app.use('/api/companies', require('./routes/companies'));
app.use('/api/regulations', require('./routes/regulations'));
app.use('/api/esg-data', require('./routes/esg-data'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/knowledge-base', require('./routes/knowledge-base'));
app.use('/api/chatbot', require('./routes/chatbot'));

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`🚀 ESG Copilot API running on port ${PORT}`);
  console.log(`📊 Environment: ${config.nodeEnv}`);
  console.log(`🔐 Auth0 Domain: ${config.auth0.domain}`);
});

module.exports = app;
