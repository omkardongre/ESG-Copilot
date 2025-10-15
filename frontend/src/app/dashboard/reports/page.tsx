'use client';

import { useUser } from '@auth0/nextjs-auth0/client';

export default function ReportsPage() {
  const { user } = useUser();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">ESG Reports</h1>
        <p className="text-gray-600 mt-2">
          Generate GRI, SASB, and TCFD reports with AI-powered narratives
        </p>
      </div>

      {/* Auth0 Feature Highlight */}
      <div className="bg-purple-50 border border-purple-200 text-purple-700 px-4 py-3 rounded mb-6">
        <p className="font-semibold">🤖 AI Agent: Report Generator</p>
        <p className="text-sm mt-1">
          This agent uses Google Gemini to write professional ESG narratives and generate PDF reports.
          Access is controlled by Auth0 role-based permissions.
        </p>
      </div>

      {/* Report Generator Demo */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Generate New Report</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Company
            </label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500">
              <option>Select a company...</option>
              <option>Demo Company Inc.</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Framework
            </label>
            <div className="grid grid-cols-3 gap-4">
              <button className="px-4 py-3 border-2 border-green-600 bg-green-50 text-green-700 rounded-lg font-semibold">
                GRI
              </button>
              <button className="px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-green-600">
                SASB
              </button>
              <button className="px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-green-600">
                TCFD
              </button>
            </div>
          </div>

          <button className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold">
            🤖 Generate Report with AI
          </button>
        </div>
      </div>

      {/* Sample Reports */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Reports</h2>
        
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-4">
          <p className="text-sm">
            <strong>Demo Mode:</strong> Connect to the backend API to see actual reports. 
            Make sure Auth0 is configured and the backend is running.
          </p>
        </div>

        <div className="space-y-4">
          {/* Sample Report Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">GRI Sustainability Report 2025</h3>
                <p className="text-sm text-gray-600 mt-1">Demo Company Inc. • Generated 2 days ago</p>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full font-medium">
                Approved
              </span>
            </div>
            
            <div className="flex space-x-3">
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                📄 Download PDF
              </button>
              <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                View Details
              </button>
            </div>
          </div>

          {/* Draft Report */}
          <div className="bg-white rounded-lg shadow p-6 opacity-75">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">TCFD Climate Report 2025</h3>
                <p className="text-sm text-gray-600 mt-1">Demo Company Inc. • Generated 5 days ago</p>
              </div>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm rounded-full font-medium">
                Draft
              </span>
            </div>
            
            <div className="flex space-x-3">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Request Approval
              </button>
              <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
