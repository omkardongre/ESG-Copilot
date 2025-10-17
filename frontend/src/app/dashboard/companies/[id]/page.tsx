'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@auth0/nextjs-auth0/client';

interface Company {
  company_id: string;
  name: string;
  industry: string;
  country: string;
  employees?: number;
  revenue?: number;
  public_status?: string;
  status?: string;
  created_at?: string;
}

export default function CompanyDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [researching, setResearching] = useState(false);
  const [researchResult, setResearchResult] = useState<any>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [collectingData, setCollectingData] = useState(false);
  const [dataResult, setDataResult] = useState<any>(null);
  const [showDataModal, setShowDataModal] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchCompanyDetails();
    }
  }, [params.id]);

  const fetchCompanyDetails = async () => {
    try {
      setLoading(true);
      const tokenResponse = await fetch('/api/auth/token');
      const { accessToken } = await tokenResponse.json();

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/companies/${params.id}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch company details');
      }

      const data = await response.json();
      setCompany(data.company);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResearchRegulations = async () => {
    if (!company) return;

    try {
      setResearching(true);
      setError('');

      const tokenResponse = await fetch('/api/auth/token');
      const { accessToken } = await tokenResponse.json();

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/regulations/research/${company.company_id}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to research regulations');
      }

      const data = await response.json();
      
      // Remove duplicate frameworks
      const uniqueFrameworks = Array.from(new Set(data.frameworks));
      data.frameworks = uniqueFrameworks;
      
      setResearchResult(data);
      setShowResultModal(true);
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setResearching(false);
    }
  };

  const handleCollectESGData = async () => {
    if (!company) return;

    try {
      setCollectingData(true);

      const tokenResponse = await fetch('/api/auth/token');
      const { accessToken } = await tokenResponse.json();

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/esg-data/collect/${company.company_id}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to collect ESG data');
      }

      const data = await response.json();
      setDataResult(data);
      setShowDataModal(true);
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setCollectingData(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Loading company details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <p className="font-semibold">Error:</p>
        <p>{error}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          ← Go Back
        </button>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Company not found</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          ← Go Back
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Result Modal */}
      {showResultModal && researchResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-green-600 flex items-center">
                  <span className="mr-2">✅</span>
                  Regulation Research Complete!
                </h3>
                <button
                  onClick={() => setShowResultModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-lg font-semibold text-blue-900">
                  Found {researchResult.regulationsFound} applicable regulations
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  via real-time web search (Google Search grounding)
                </p>
              </div>

              {/* Frameworks */}
              <div className="mb-4">
                <p className="font-semibold text-gray-700 mb-2">Recommended Frameworks:</p>
                <div className="flex flex-wrap gap-2">
                  {researchResult.frameworks.map((framework: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium"
                    >
                      {framework}
                    </span>
                  ))}
                </div>
              </div>

              {/* Regulations List */}
              {researchResult.regulations && researchResult.regulations.length > 0 && (
                <div className="mb-4">
                  <p className="font-semibold text-gray-700 mb-3">Regulations Found:</p>
                  <div className="space-y-3">
                    {researchResult.regulations.map((reg: any, idx: number) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{reg.name}</p>
                            <p className="text-sm text-gray-600 mt-1">{reg.description}</p>
                            <div className="flex gap-2 mt-2">
                              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                {reg.jurisdiction}
                              </span>
                              <span
                                className={`text-xs px-2 py-1 rounded ${
                                  reg.type === 'mandatory'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-green-100 text-green-800'
                                }`}
                              >
                                {reg.type}
                              </span>
                              <span
                                className={`text-xs px-2 py-1 rounded ${
                                  reg.priority === 'high'
                                    ? 'bg-orange-100 text-orange-800'
                                    : reg.priority === 'medium'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {reg.priority} priority
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="mt-6">
                <button
                  onClick={() => setShowResultModal(false)}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ESG Data Collection Result Modal */}
      {showDataModal && dataResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-green-600 flex items-center">
                  <span className="mr-2">✅</span>
                  ESG Data Collection Complete!
                </h3>
                <button
                  onClick={() => setShowDataModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-lg font-semibold text-blue-900">
                  Collected {dataResult.recordsStored} ESG data points
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  from {dataResult.sources?.length || 0} sources: {dataResult.sources?.join(', ')}
                </p>
              </div>

              {/* Data Categories */}
              <div className="space-y-4">
                {/* Environmental Data */}
                {dataResult.dataCollected?.environmental && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <span className="mr-2">🌍</span>
                      Environmental Data
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(dataResult.dataCollected.environmental).map(([key, value]: [string, any]) => {
                        if (typeof value === 'object') return null;
                        return (
                          <div key={key} className="bg-gray-50 p-2 rounded">
                            <p className="text-xs text-gray-500 capitalize">
                              {key.replace(/_/g, ' ')}
                            </p>
                            <p className="font-semibold text-gray-900">{String(value)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Social Data */}
                {dataResult.dataCollected?.social && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <span className="mr-2">👥</span>
                      Social Data
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(dataResult.dataCollected.social).map(([key, value]: [string, any]) => (
                        <div key={key} className="bg-gray-50 p-2 rounded">
                          <p className="text-xs text-gray-500 capitalize">
                            {key.replace(/_/g, ' ')}
                          </p>
                          <p className="font-semibold text-gray-900">{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Governance Data */}
                {dataResult.dataCollected?.governance && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <span className="mr-2">⚖️</span>
                      Governance Data
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(dataResult.dataCollected.governance).map(([key, value]: [string, any]) => (
                        <div key={key} className="bg-gray-50 p-2 rounded">
                          <p className="text-xs text-gray-500 capitalize">
                            {key.replace(/_/g, ' ')}
                          </p>
                          <p className="font-semibold text-gray-900">{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-6">
                <button
                  onClick={() => setShowDataModal(false)}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="text-green-600 hover:text-green-700 mb-4 flex items-center"
        >
          ← Back to Companies
        </button>
        <h1 className="text-3xl font-bold text-gray-900">{company.name}</h1>
        <p className="text-gray-600 mt-2">Company Details & ESG Actions</p>
      </div>

      {/* Company Info Card */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Company Information</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Company ID</p>
            <p className="font-mono text-sm">{company.company_id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Industry</p>
            <p className="font-semibold">{company.industry}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Country</p>
            <p className="font-semibold">{company.country}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <span
              className={`px-2 py-1 rounded text-sm ${
                company.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {company.status || 'active'}
            </span>
          </div>
          {company.employees && (
            <div>
              <p className="text-sm text-gray-500">Employees</p>
              <p className="font-semibold">{company.employees.toLocaleString()}</p>
            </div>
          )}
          {company.revenue && (
            <div>
              <p className="text-sm text-gray-500">Annual Revenue</p>
              <p className="font-semibold">${company.revenue.toLocaleString()}</p>
            </div>
          )}
          {company.public_status && (
            <div>
              <p className="text-sm text-gray-500">Public Status</p>
              <p className="font-semibold capitalize">{company.public_status}</p>
            </div>
          )}
          {company.created_at && (
            <div>
              <p className="text-sm text-gray-500">Created</p>
              <p className="text-sm">{new Date(company.created_at).toLocaleDateString()}</p>
            </div>
          )}
        </div>
      </div>

      {/* AI Agent Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">🤖 AI Agent Actions</h2>
        <p className="text-gray-600 mb-4">
          Trigger autonomous AI agents to research regulations, collect ESG data, and generate
          reports
        </p>

        <div className="space-y-3">
          <button
            onClick={handleResearchRegulations}
            disabled={researching}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-left flex items-center justify-between transition-all"
          >
            <div>
              <p className="font-semibold">1. Research Regulations (AI Agent)</p>
              <p className="text-sm text-blue-100">
                {researching
                  ? '🔍 Searching web for latest ESG regulations...'
                  : 'AI analyzes industry, country, and size to identify applicable ESG regulations'}
              </p>
            </div>
            {researching ? (
              <div className="flex items-center gap-2">
                <svg
                  className="animate-spin h-6 w-6 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
            ) : (
              <span className="text-2xl">🔍</span>
            )}
          </button>

          <button
            onClick={handleCollectESGData}
            disabled={collectingData}
            className="w-full px-4 py-3 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-left flex items-center justify-between transition-all"
          >
            <div>
              <p className="font-semibold">2. Collect ESG Data (AI Agent)</p>
              <p className="text-sm text-green-100">
                {collectingData
                  ? '📊 Collecting data from EPA, web scraping, and AI estimation...'
                  : 'Parallel data collection from EPA, web scraping, and AI estimation'}
              </p>
            </div>
            {collectingData ? (
              <div className="flex items-center gap-2">
                <svg
                  className="animate-spin h-6 w-6 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
            ) : (
              <span className="text-2xl">📊</span>
            )}
          </button>

          <button
            onClick={() =>
              alert(
                'Report Generator Agent\n\nThis will:\n- Generate GRI/SASB/TCFD report\n- Create charts and visualizations\n- Format as PDF/Excel\n\n(Not yet implemented)'
              )
            }
            className="w-full px-4 py-3 bg-purple-600 text-white rounded hover:bg-purple-700 text-left flex items-center justify-between"
          >
            <div>
              <p className="font-semibold">3. Generate ESG Report (AI Agent)</p>
              <p className="text-sm text-purple-100">
                AI creates comprehensive ESG report with GRI/SASB/TCFD frameworks
              </p>
            </div>
            <span className="text-2xl">📄</span>
          </button>
        </div>
      </div>

      {/* Auth0 Feature Notice */}
      <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
        <p className="font-semibold">🔐 Auth0 Feature: Control the Tools</p>
        <p className="text-sm mt-1">
          AI agents retrieve API keys from Token Vault in your JWT. Logged in as{' '}
          <strong>{user?.email}</strong>
        </p>
      </div>
    </div>
  );
}
