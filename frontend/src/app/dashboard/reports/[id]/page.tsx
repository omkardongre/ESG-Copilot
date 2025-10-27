'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@auth0/nextjs-auth0/client';

interface Report {
  report_id: string;
  company_id: string;
  framework: string;
  reporting_period: string;
  status: string;
  generated_by: string;
  generated_at: string | { value: string };
  content: any;
}

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (params.id) {
      fetchReport();
    }
  }, [params.id]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const tokenResponse = await fetch('/api/auth/token');
      const { accessToken } = await tokenResponse.json();

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/reports/${params.id}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch report');
      }

      const data = await response.json();
      setReport(data.report);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">❌ {error || 'Report not found'}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-red-600 hover:text-red-700 underline"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  const content = typeof report.content === 'string' 
    ? JSON.parse(report.content) 
    : report.content;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-purple-600 hover:text-purple-700 mb-4 flex items-center"
        >
          ← Back
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {report.framework} Sustainability Report
            </h1>
            <p className="text-gray-600 mt-2">
              Report ID: {report.report_id}
            </p>
            <p className="text-sm text-gray-500">
              Generated: {report.generated_at ? new Date(typeof report.generated_at === 'object' ? report.generated_at.value : report.generated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
            </p>
          </div>
          <span
            className={`px-4 py-2 rounded-full text-sm font-semibold ${
              report.status === 'draft'
                ? 'bg-yellow-100 text-yellow-800'
                : report.status === 'approved'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {report.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Executive Summary */}
      {content.executiveSummary && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">📋</span>
            Executive Summary
          </h2>
          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
            {content.executiveSummary}
          </p>
        </div>
      )}

      {/* Environmental Section */}
      {content.environmental && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">🌍</span>
            Environmental Performance
          </h2>
          
          {content.environmental.overview && (
            <p className="text-gray-700 mb-6 leading-relaxed">
              {content.environmental.overview}
            </p>
          )}

          {/* Key Metrics */}
          {content.environmental.keyMetrics && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Key Metrics</h3>
              <div className="space-y-4">
                {content.environmental.keyMetrics.map((metric: any, idx: number) => (
                  <div key={idx} className="border-l-4 border-green-500 pl-4 py-2">
                    <p className="font-semibold text-gray-900">{metric.metric}</p>
                    <p className="text-2xl font-bold text-green-600 my-1">{metric.value}</p>
                    <p className="text-sm text-gray-600">{metric.analysis}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Initiatives */}
          {content.environmental.initiatives && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Key Initiatives</h3>
              <ul className="space-y-2">
                {content.environmental.initiatives.map((initiative: string, idx: number) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-gray-700">{initiative}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Targets */}
          {content.environmental.targets && (
            <div>
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Targets</h3>
              <ul className="space-y-2">
                {content.environmental.targets.map((target: string, idx: number) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-blue-600 mr-2">🎯</span>
                    <span className="text-gray-700">{target}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Social Section */}
      {content.social && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">👥</span>
            Social Performance
          </h2>
          
          {content.social.overview && (
            <p className="text-gray-700 mb-6 leading-relaxed">
              {content.social.overview}
            </p>
          )}

          {/* Key Metrics */}
          {content.social.keyMetrics && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Key Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {content.social.keyMetrics.map((metric: any, idx: number) => (
                  <div key={idx} className="border border-blue-200 rounded-lg p-4">
                    <p className="font-semibold text-gray-900 mb-2">{metric.metric}</p>
                    <p className="text-2xl font-bold text-blue-600 mb-2">{metric.value}</p>
                    <p className="text-sm text-gray-600">{metric.analysis}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Initiatives */}
          {content.social.initiatives && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Key Initiatives</h3>
              <ul className="space-y-2">
                {content.social.initiatives.map((initiative: string, idx: number) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-blue-600 mr-2">✓</span>
                    <span className="text-gray-700">{initiative}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Targets */}
          {content.social.targets && (
            <div>
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Targets</h3>
              <ul className="space-y-2">
                {content.social.targets.map((target: string, idx: number) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-blue-600 mr-2">🎯</span>
                    <span className="text-gray-700">{target}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Governance Section */}
      {content.governance && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">⚖️</span>
            Governance
          </h2>
          
          {content.governance.overview && (
            <p className="text-gray-700 mb-6 leading-relaxed">
              {content.governance.overview}
            </p>
          )}

          {/* Key Metrics */}
          {content.governance.keyMetrics && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Key Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {content.governance.keyMetrics.map((metric: any, idx: number) => (
                  <div key={idx} className="border border-purple-200 rounded-lg p-4">
                    <p className="font-semibold text-gray-900 mb-2">{metric.metric}</p>
                    <p className="text-2xl font-bold text-purple-600 mb-2">{metric.value}</p>
                    <p className="text-sm text-gray-600">{metric.analysis}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Policies */}
          {content.governance.policies && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Policies</h3>
              <div className="flex flex-wrap gap-2">
                {content.governance.policies.map((policy: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                  >
                    {policy}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {content.recommendations && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-blue-900 mb-4">💡 Recommendations</h2>
          <ul className="space-y-2">
            {content.recommendations.map((rec: string, idx: number) => (
              <li key={idx} className="flex items-start">
                <span className="text-blue-600 mr-2">→</span>
                <span className="text-blue-800">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
