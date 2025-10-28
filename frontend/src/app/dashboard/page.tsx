'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import Link from 'next/link';

export default function DashboardHome() {
  const { user } = useUser();

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome, {user?.name || 'User'}</h2>
        <p className="text-gray-600">Manage your ESG compliance with AI-powered automation</p>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <Link href="/dashboard/companies">
          <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow cursor-pointer border-l-4 border-green-500">
            <div className="flex items-center mb-3">
              <span className="text-3xl mr-3">🏢</span>
              <h3 className="font-bold text-lg text-gray-800">Companies</h3>
            </div>
            <p className="text-sm text-gray-600">Manage company profiles and ESG compliance</p>
          </div>
        </Link>

        <Link href="/dashboard/reports">
          <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow cursor-pointer border-l-4 border-blue-500">
            <div className="flex items-center mb-3">
              <span className="text-3xl mr-3">📄</span>
              <h3 className="font-bold text-lg text-gray-800">Reports</h3>
            </div>
            <p className="text-sm text-gray-600">View and manage all ESG reports</p>
          </div>
        </Link>

        <Link href="/dashboard/chat">
          <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow cursor-pointer border-l-4 border-purple-500">
            <div className="flex items-center mb-3">
              <span className="text-3xl mr-3">💬</span>
              <h3 className="font-bold text-lg text-gray-800">AI Chat</h3>
            </div>
            <p className="text-sm text-gray-600">Ask questions about your ESG data</p>
          </div>
        </Link>
      </div>

      {/* AI Agents Section */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-xl shadow-lg border border-blue-100">
        <h3 className="text-2xl font-bold mb-2 text-gray-800">🤖 AI Agents</h3>
        <p className="text-gray-600 mb-8">Autonomous agents for production-ready ESG compliance</p>

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
              Calculates Scope 1, 2, 3 carbon emissions using Climatiq API
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
              Permission-aware Q&A with company-scoped knowledge base
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
