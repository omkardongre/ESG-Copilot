'use client';

import { useUser } from '@auth0/nextjs-auth0/client';

export default function RegulationsPage() {
  const { user } = useUser();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Regulation Research</h1>
        <p className="text-gray-600 mt-2">
          AI-powered identification of applicable ESG regulations and frameworks
        </p>
      </div>

      {/* Auth0 Feature Highlight */}
      <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
        <p className="font-semibold">🤖 AI Agent: Regulation Research Agent</p>
        <p className="text-sm mt-1">
          This agent uses Google Gemini to identify applicable regulations (EU CSRD, SEC Climate, TCFD) 
          and recommend frameworks (GRI, SASB, CDP) based on company data.
        </p>
      </div>

      {/* Regulations List */}
      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold">EU Corporate Sustainability Reporting Directive (CSRD)</h3>
              <p className="text-sm text-gray-600 mt-1">European Union • Mandatory for large companies</p>
            </div>
            <span className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded-full font-medium">
              Applicable
            </span>
          </div>
          <p className="text-sm text-gray-700 mb-3">
            Requires detailed sustainability reporting including environmental, social, and governance metrics.
          </p>
          <div className="flex items-center text-sm text-gray-600">
            <span className="font-medium">Deadline:</span>
            <span className="ml-2">January 1, 2026</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold">SEC Climate Disclosure Rule</h3>
              <p className="text-sm text-gray-600 mt-1">United States • Public companies</p>
            </div>
            <span className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded-full font-medium">
              Applicable
            </span>
          </div>
          <p className="text-sm text-gray-700 mb-3">
            Requires disclosure of climate-related risks, greenhouse gas emissions, and climate targets.
          </p>
          <div className="flex items-center text-sm text-gray-600">
            <span className="font-medium">Deadline:</span>
            <span className="ml-2">Fiscal year 2025</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold">Task Force on Climate-related Financial Disclosures (TCFD)</h3>
              <p className="text-sm text-gray-600 mt-1">Global • Voluntary framework</p>
            </div>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full font-medium">
              Recommended
            </span>
          </div>
          <p className="text-sm text-gray-700 mb-3">
            Framework for disclosing climate-related financial risks and opportunities.
          </p>
          <div className="flex items-center text-sm text-gray-600">
            <span className="font-medium">Status:</span>
            <span className="ml-2">Widely adopted globally</span>
          </div>
        </div>
      </div>

      {/* Recommended Frameworks */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Recommended Reporting Frameworks</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-2">GRI Standards</h3>
            <p className="text-sm text-gray-600">
              Global Reporting Initiative - Most widely used sustainability reporting framework
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-2">SASB Standards</h3>
            <p className="text-sm text-gray-600">
              Sustainability Accounting Standards Board - Industry-specific metrics
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-2">CDP</h3>
            <p className="text-sm text-gray-600">
              Carbon Disclosure Project - Environmental impact disclosure
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
