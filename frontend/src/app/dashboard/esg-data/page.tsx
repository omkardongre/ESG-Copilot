'use client';

import { useUser } from '@auth0/nextjs-auth0/client';

export default function ESGDataPage() {
  const { user } = useUser();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">ESG Data Collection</h1>
        <p className="text-gray-600 mt-2">
          Collect environmental, social, and governance metrics from multiple sources
        </p>
      </div>

      {/* Auth0 Feature Highlight */}
      <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-6">
        <p className="font-semibold">🔑 Auth0 Feature: Token Vault</p>
        <p className="text-sm mt-1">
          API keys for EPA, Climatiq, and other services are securely stored in Auth0 Token Vault.
          The ESG Data Collection Agent retrieves them at runtime without exposing credentials.
        </p>
      </div>

      {/* Data Collection Agent */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">🤖 Collect Data with AI Agent</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Company
            </label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option>Select a company...</option>
              <option>Demo Company Inc.</option>
            </select>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Data Sources</h3>
            <div className="space-y-2 text-sm">
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" defaultChecked />
                <span>EPA Envirofacts API (Environmental data)</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" defaultChecked />
                <span>Company Website Scraping (AI-powered)</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span>Climatiq Carbon API (Emissions data)</span>
              </label>
            </div>
          </div>

          <button className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
            🤖 Collect ESG Data
          </button>
        </div>
      </div>

      {/* ESG Metrics Dashboard */}
      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Environmental</h3>
          <p className="text-3xl font-bold text-green-600">12</p>
          <p className="text-sm text-gray-500 mt-1">metrics collected</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Social</h3>
          <p className="text-3xl font-bold text-blue-600">8</p>
          <p className="text-sm text-gray-500 mt-1">metrics collected</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Governance</h3>
          <p className="text-3xl font-bold text-purple-600">6</p>
          <p className="text-sm text-gray-500 mt-1">metrics collected</p>
        </div>
      </div>

      {/* Sample Data */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Collected Metrics</h2>
        
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metric</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">Environmental</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">Carbon Emissions</td>
                <td className="px-6 py-4 text-sm text-gray-900">1,250 tons CO2e</td>
                <td className="px-6 py-4 text-sm text-gray-500">EPA API</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">Environmental</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">Energy Consumption</td>
                <td className="px-6 py-4 text-sm text-gray-900">3,500 MWh</td>
                <td className="px-6 py-4 text-sm text-gray-500">Company Website</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">Social</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">Employee Turnover</td>
                <td className="px-6 py-4 text-sm text-gray-900">12%</td>
                <td className="px-6 py-4 text-sm text-gray-500">AI Analysis</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">Social</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">Women in Leadership</td>
                <td className="px-6 py-4 text-sm text-gray-900">35%</td>
                <td className="px-6 py-4 text-sm text-gray-500">Company Website</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">Governance</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">Board Independence</td>
                <td className="px-6 py-4 text-sm text-gray-900">75%</td>
                <td className="px-6 py-4 text-sm text-gray-500">AI Analysis</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
