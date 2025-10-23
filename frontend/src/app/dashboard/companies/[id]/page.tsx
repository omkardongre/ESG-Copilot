'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@auth0/nextjs-auth0/client';

interface Company {
  company_id: string;
  name: string;
  industry: string;
  country: string;
  city?: string;
  website?: string;
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
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportResult, setReportResult] = useState<any>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState<string>('GRI');
  const [calculatingEmissions, setCalculatingEmissions] = useState(false);
  const [emissionsResult, setEmissionsResult] = useState<any>(null);
  const [showEmissionsModal, setShowEmissionsModal] = useState(false);
  const [sendingOutreach, setSendingOutreach] = useState(false);
  const [outreachResult, setOutreachResult] = useState<any>(null);
  const [showOutreachModal, setShowOutreachModal] = useState(false);
  const [outreachError, setOutreachError] = useState<string | null>(null);

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

  const handleCalculateEmissions = async () => {
    if (!company) return;

    try {
      setCalculatingEmissions(true);

      const tokenResponse = await fetch('/api/auth/token');
      const { accessToken } = await tokenResponse.json();

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/emissions/calculate/${company.company_id}`,
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
        throw new Error(errorData.error || errorData.message || 'Failed to calculate emissions');
      }

      const data = await response.json();
      setEmissionsResult(data);
      setShowEmissionsModal(true);
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setCalculatingEmissions(false);
    }
  };

  const handleSendOutreach = async () => {
    if (!company) return;

    try {
      setSendingOutreach(true);

      const tokenResponse = await fetch('/api/auth/token');
      const { accessToken } = await tokenResponse.json();

      // Get the latest report ID (in production, let user select)
      const reportsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/reports?companyId=${company.company_id}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!reportsResponse.ok) {
        throw new Error('No ESG reports found for this company. Please generate a report first using one of the report generation buttons below (GRI, SASB, or TCFD).');
      }

      const reportsData = await reportsResponse.json();
      if (!reportsData.reports || reportsData.reports.length === 0) {
        throw new Error('No ESG reports found for this company. Please generate a report first using one of the report generation buttons below (GRI, SASB, or TCFD).');
      }

      const latestReport = reportsData.reports[0];

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/outreach/send/${company.company_id}/${latestReport.report_id}`,
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
        throw new Error(errorData.error || errorData.message || 'Failed to send outreach');
      }

      const data = await response.json();
      setOutreachResult(data);
      setShowOutreachModal(true);
      setOutreachError(null);
    } catch (err: any) {
      setOutreachError(err.message);
      console.error('Outreach error:', err);
    } finally {
      setSendingOutreach(false);
    }
  };

  const handleGenerateReport = async (framework: string) => {
    if (!company) return;

    try {
      setGeneratingReport(true);
      setSelectedFramework(framework);

      const tokenResponse = await fetch('/api/auth/token');
      const { accessToken } = await tokenResponse.json();

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/reports/generate/${company.company_id}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ framework }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate report');
      }

      const data = await response.json();
      setReportResult(data);
      setShowReportModal(true);
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setGeneratingReport(false);
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

      {/* Report Generation Result Modal */}
      {showReportModal && reportResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-purple-600 flex items-center">
                  <span className="mr-2">✅</span>
                  ESG Report Generated!
                </h3>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Summary */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                <p className="text-lg font-semibold text-purple-900">
                  {reportResult.framework} Report for {reportResult.companyName}
                </p>
                <p className="text-sm text-purple-700 mt-1">
                  Report ID: {reportResult.reportId}
                </p>
                <p className="text-sm text-purple-700">
                  Status: <span className="font-semibold capitalize">{reportResult.status}</span>
                </p>
              </div>

              {/* Report Content Preview */}
              {reportResult.content && (
                <div className="space-y-4">
                  {/* Executive Summary */}
                  {reportResult.content.executiveSummary && (
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-2">📋 Executive Summary</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {reportResult.content.executiveSummary.substring(0, 300)}...
                      </p>
                    </div>
                  )}

                  {/* Sections */}
                  <div className="grid grid-cols-3 gap-3">
                    {reportResult.content.environmental && (
                      <div className="border border-green-200 bg-green-50 rounded-lg p-3">
                        <p className="font-semibold text-green-900 text-sm">🌍 Environmental</p>
                        <p className="text-xs text-green-700 mt-1">Section completed</p>
                      </div>
                    )}
                    {reportResult.content.social && (
                      <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
                        <p className="font-semibold text-blue-900 text-sm">👥 Social</p>
                        <p className="text-xs text-blue-700 mt-1">Section completed</p>
                      </div>
                    )}
                    {reportResult.content.governance && (
                      <div className="border border-purple-200 bg-purple-50 rounded-lg p-3">
                        <p className="font-semibold text-purple-900 text-sm">⚖️ Governance</p>
                        <p className="text-xs text-purple-700 mt-1">Section completed</p>
                      </div>
                    )}
                  </div>

                  {/* AI Agent Info */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="font-semibold text-gray-900 mb-2">🤖 Multi-Agent Generation</p>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>✅ Executive Summary Writer Agent</li>
                      <li>✅ Environmental Section Writer Agent</li>
                      <li>✅ Social Section Writer Agent</li>
                      <li>✅ Governance Section Writer Agent</li>
                      <li>✅ Review & Critique Agent (Quality Check)</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => router.push(`/dashboard/reports/${reportResult.reportId}`)}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
                >
                  View Full Report
                </button>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Outreach Result Modal */}
      {showOutreachModal && outreachResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-pink-600 flex items-center">
                  <span className="mr-2">✅</span>
                  Outreach Completed!
                </h3>
                <button
                  onClick={() => setShowOutreachModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Summary */}
              <div className="bg-pink-50 border border-pink-200 rounded-lg p-4 mb-4">
                <p className="text-lg font-semibold text-pink-900">
                  📧 {outreachResult.outreach.emails_sent} email(s) sent successfully
                </p>
                <p className="text-sm text-pink-700 mt-1">
                  via SendGrid API (Token Vault)
                </p>
              </div>

              {/* Email Results */}
              {outreachResult.outreach.email_results && outreachResult.outreach.email_results.length > 0 && (
                <div className="mb-4">
                  <p className="font-semibold text-gray-700 mb-2">Email Delivery Status:</p>
                  <div className="space-y-2">
                    {outreachResult.outreach.email_results.map((result: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border ${
                          result.status === 'sent'
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">{result.email}</p>
                            <p className="text-sm text-gray-600">
                              {result.status === 'sent' ? '✅ Delivered' : '❌ Failed'}
                            </p>
                          </div>
                          {result.sentAt && (
                            <p className="text-xs text-gray-500">
                              {new Date(result.sentAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                        {result.error && (
                          <p className="text-sm text-red-600 mt-2">Error: {result.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Steps */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="font-semibold text-blue-900 mb-2">📬 Next Steps:</p>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Check your email inbox for the ESG report notification</li>
                  <li>• Email includes emissions data and executive summary</li>
                  <li>• Click "View Full Report" button in email to access platform</li>
                  <li>• Check spam folder if email not received</li>
                </ul>
              </div>

              {/* Footer */}
              <div className="mt-6">
                <button
                  onClick={() => setShowOutreachModal(false)}
                  className="w-full px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 font-semibold"
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
          {company.city && (
            <div>
              <p className="text-sm text-gray-500">City</p>
              <p className="font-semibold">{company.city}</p>
            </div>
          )}
          {company.website && (
            <div>
              <p className="text-sm text-gray-500">Website</p>
              <a 
                href={company.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm"
              >
                {company.website}
              </a>
            </div>
          )}
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
              <p className="text-sm">
                {company.created_at.value 
                  ? new Date(company.created_at.value).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  : new Date(company.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                }
              </p>
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
            onClick={handleCalculateEmissions}
            disabled={calculatingEmissions}
            className="w-full px-4 py-3 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:bg-orange-400 disabled:cursor-not-allowed text-left flex items-center justify-between transition-all"
          >
            <div>
              <p className="font-semibold">3. Calculate Emissions (AI Agent)</p>
              <p className="text-sm text-orange-100">
                {calculatingEmissions
                  ? '🌍 Calculating Scope 1, 2, 3 emissions with Climatiq API...'
                  : 'Calculate carbon footprint using Climatiq API (Token Vault)'}
              </p>
            </div>
            {calculatingEmissions ? (
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
              <span className="text-2xl">🌍</span>
            )}
          </button>

          {/* Outreach Error Display */}
          {outreachError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <span className="text-red-600 text-xl mr-3">⚠️</span>
                <div className="flex-1">
                  <p className="font-semibold text-red-900 mb-1">Cannot Send Outreach</p>
                  <p className="text-sm text-red-700">{outreachError}</p>
                  <button
                    onClick={() => setOutreachError(null)}
                    className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleSendOutreach}
            disabled={sendingOutreach}
            className="w-full px-4 py-3 bg-pink-600 text-white rounded hover:bg-pink-700 disabled:bg-pink-400 disabled:cursor-not-allowed text-left flex items-center justify-between transition-all"
          >
            <div>
              <p className="font-semibold">4. Send to Stakeholders</p>
              <p className="text-sm text-pink-100">
                {sendingOutreach
                  ? '📧 Sending email notifications via SendGrid...'
                  : 'Send email notifications to stakeholders with emissions data'}
              </p>
            </div>
            {sendingOutreach ? (
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
              <span className="text-2xl">📧</span>
            )}
          </button>

          <div className="space-y-2">
            <p className="font-semibold text-gray-900">5. Generate ESG Report (AI Agent)</p>
            <p className="text-sm text-gray-600 mb-3">
              Select a framework to generate a comprehensive ESG report
            </p>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleGenerateReport('GRI')}
                disabled={generatingReport}
                className="px-4 py-3 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed transition-all relative"
              >
                {generatingReport && selectedFramework === 'GRI' ? (
                  <div className="flex flex-col items-center justify-center">
                    <svg
                      className="animate-spin h-5 w-5 text-white mb-1"
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
                    <p className="text-xs">Generating...</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="font-semibold">GRI</p>
                    <p className="text-xs text-purple-100">Global Standard</p>
                  </div>
                )}
              </button>
              <button
                onClick={() => handleGenerateReport('SASB')}
                disabled={generatingReport}
                className="px-4 py-3 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-all relative"
              >
                {generatingReport && selectedFramework === 'SASB' ? (
                  <div className="flex flex-col items-center justify-center">
                    <svg
                      className="animate-spin h-5 w-5 text-white mb-1"
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
                    <p className="text-xs">Generating...</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="font-semibold">SASB</p>
                    <p className="text-xs text-indigo-100">Industry-Specific</p>
                  </div>
                )}
              </button>
              <button
                onClick={() => handleGenerateReport('TCFD')}
                disabled={generatingReport}
                className="px-4 py-3 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:bg-violet-400 disabled:cursor-not-allowed transition-all relative"
              >
                {generatingReport && selectedFramework === 'TCFD' ? (
                  <div className="flex flex-col items-center justify-center">
                    <svg
                      className="animate-spin h-5 w-5 text-white mb-1"
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
                    <p className="text-xs">Generating...</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="font-semibold">TCFD</p>
                    <p className="text-xs text-violet-100">Climate-Focused</p>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
