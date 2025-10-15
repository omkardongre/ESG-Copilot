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
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Link
                href="/dashboard/companies"
                className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition"
              >
                <div className="text-4xl mb-3">🏢</div>
                <h3 className="text-lg font-semibold mb-2">Companies</h3>
                <p className="text-gray-600 text-sm">
                  Manage company profiles and discover new clients
                </p>
              </Link>

              <Link
                href="/dashboard/regulations"
                className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition"
              >
                <div className="text-4xl mb-3">📋</div>
                <h3 className="text-lg font-semibold mb-2">Regulations</h3>
                <p className="text-gray-600 text-sm">
                  AI-powered regulation research and compliance tracking
                </p>
              </Link>

              <Link
                href="/dashboard/esg-data"
                className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition"
              >
                <div className="text-4xl mb-3">📊</div>
                <h3 className="text-lg font-semibold mb-2">ESG Data</h3>
                <p className="text-gray-600 text-sm">
                  Collect environmental, social, and governance metrics
                </p>
              </Link>

              <Link
                href="/dashboard/reports"
                className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition"
              >
                <div className="text-4xl mb-3">📄</div>
                <h3 className="text-lg font-semibold mb-2">Reports</h3>
                <p className="text-gray-600 text-sm">
                  Generate GRI, SASB, and TCFD reports with AI
                </p>
              </Link>
            </div>

            {/* AI Agents Section */}
            <div className="mt-12 bg-white p-8 rounded-xl shadow-md">
              <h3 className="text-2xl font-bold mb-6">🤖 AI Agents</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-semibold mb-2">Regulation Research Agent</h4>
                  <p className="text-sm text-gray-600">
                    Identifies applicable ESG regulations (EU CSRD, SEC Climate, TCFD) and recommends frameworks
                  </p>
                </div>
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-semibold mb-2">ESG Data Collection Agent</h4>
                  <p className="text-sm text-gray-600">
                    Scrapes company websites and integrates with EPA API to collect sustainability data
                  </p>
                </div>
                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-semibold mb-2">Report Generator Agent</h4>
                  <p className="text-sm text-gray-600">
                    Writes professional ESG narratives and generates PDF reports with AI
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
