'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import Link from 'next/link';

export default function Home() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">🌱</span>
            <h1 className="text-2xl font-bold text-green-700">ESG Copilot</h1>
          </div>
          <div>
            {user ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  {user.email}
                </span>
                <a
                  href="/api/auth/logout"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Logout
                </a>
              </div>
            ) : (
              <a
                href="/api/auth/login"
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
              >
                Login with Auth0
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {!user ? (
          <div className="text-center">
            <h2 className="text-5xl font-bold text-gray-900 mb-6">
              AI-Powered ESG Compliance
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Automate sustainability reporting with AI agents secured by Auth0.
              Generate GRI, SASB, and TCFD reports in minutes, not months.
            </p>
            
            {/* Auth0 Features */}
            <div className="grid md:grid-cols-3 gap-6 mb-12 max-w-5xl mx-auto">
              <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="text-4xl mb-3">🔐</div>
                <h3 className="text-lg font-semibold mb-2">Authenticate the User</h3>
                <p className="text-gray-600 text-sm">
                  Secure login with Auth0 Universal Login and role-based access control
                </p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="text-4xl mb-3">🔑</div>
                <h3 className="text-lg font-semibold mb-2">Control the Tools</h3>
                <p className="text-gray-600 text-sm">
                  Token Vault securely manages API keys for EPA, Gemini, and external services
                </p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="text-4xl mb-3">🎯</div>
                <h3 className="text-lg font-semibold mb-2">Limit Knowledge</h3>
                <p className="text-gray-600 text-sm">
                  Fine-grained authorization ensures users only access their company data
                </p>
              </div>
            </div>

            <a
              href="/api/auth/login"
              className="inline-block px-8 py-4 bg-green-600 text-white text-lg rounded-lg hover:bg-green-700 transition font-semibold shadow-lg"
            >
              Get Started with Auth0
            </a>
          </div>
        ) : (
          <div>
            <h2 className="text-4xl font-bold text-gray-900 mb-8">
              Welcome back, {user.name}! 👋
            </h2>

            {/* Dashboard Links */}
            <div className="grid md:grid-cols-3 gap-6">
              <Link
                href="/dashboard/companies"
                className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition"
              >
                <div className="text-4xl mb-3">🏢</div>
                <h3 className="text-lg font-semibold mb-2">Companies</h3>
                <p className="text-gray-600 text-sm">
                  Manage company profiles and ESG compliance
                </p>
              </Link>

              <Link
                href="/dashboard/reports"
                className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition"
              >
                <div className="text-4xl mb-3">📄</div>
                <h3 className="text-lg font-semibold mb-2">Reports</h3>
                <p className="text-gray-600 text-sm">
                  View and manage all ESG reports
                </p>
              </Link>

              <Link
                href="/dashboard/chat"
                className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition"
              >
                <div className="text-4xl mb-3">💬</div>
                <h3 className="text-lg font-semibold mb-2">AI Chat</h3>
                <p className="text-gray-600 text-sm">
                  Ask questions about your ESG data
                </p>
              </Link>
            </div>

            {/* AI Agents Section */}
            <div className="mt-12 bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-xl shadow-lg border border-blue-100">
              <h3 className="text-2xl font-bold mb-2 text-gray-800">🤖 AI Agents</h3>
              <p className="text-gray-600 mb-8">Autonomous agents secured by Auth0 for production-ready ESG compliance</p>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Agent 1 */}
                <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow border-l-4 border-green-500">
                  <div className="flex items-center mb-3">
                    <span className="text-3xl mr-3">🔍</span>
                    <h4 className="font-bold text-lg text-gray-800">Regulation Research</h4>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Real-time web search to identify regulations (California SB 253, SEC Climate) and recommend frameworks (GRI, SASB, TCFD)
                  </p>
                </div>

                {/* Agent 2 */}
                <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow border-l-4 border-blue-500">
                  <div className="flex items-center mb-3">
                    <span className="text-3xl mr-3">📊</span>
                    <h4 className="font-bold text-lg text-gray-800">ESG Data Collection</h4>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Parallel data collection from EPA API, web scraping, and AI estimation with 3 sub-agents
                  </p>
                </div>

                {/* Agent 3 */}
                <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow border-l-4 border-orange-500">
                  <div className="flex items-center mb-3">
                    <span className="text-3xl mr-3">🌍</span>
                    <h4 className="font-bold text-lg text-gray-800">Emissions Calculator</h4>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Calculates Scope 1, 2, 3 carbon emissions using Climatiq API via Token Vault
                  </p>
                </div>

                {/* Agent 4 */}
                <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow border-l-4 border-purple-500">
                  <div className="flex items-center mb-3">
                    <span className="text-3xl mr-3">📄</span>
                    <h4 className="font-bold text-lg text-gray-800">Report Generator</h4>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Generates GRI, SASB, TCFD reports with iterative refinement loop (up to 3 iterations)
                  </p>
                </div>

                {/* Agent 5 */}
                <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow border-l-4 border-indigo-500">
                  <div className="flex items-center mb-3">
                    <span className="text-3xl mr-3">💬</span>
                    <h4 className="font-bold text-lg text-gray-800">Chat Agent (RAG)</h4>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Permission-aware Q&A with Auth0 FGA Store authorization and company-scoped knowledge base
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-gray-600">
          <p>
            Built for the{' '}
            <a
              href="https://dev.to/challenges/auth0-2025-10-08"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 hover:underline font-semibold"
            >
              Auth0 for AI Agents Challenge
            </a>
          </p>
          <p className="mt-2 text-sm">
            Secured by Auth0 • Powered by Google Gemini • Stored in BigQuery
          </p>
        </div>
      </footer>
    </div>
  );
}
