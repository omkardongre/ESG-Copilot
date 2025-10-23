'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Report {
  report_id: string;
  company_id: string;
  company_name: string;
  framework: string;
  status: string;
  generated_at: string;
  generated_by: string;
}

interface Company {
  company_id: string;
  name: string;
}

export default function ReportsPage() {
  const { user } = useUser();
  const [reports, setReports] = useState<Report[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [selectedFramework, setSelectedFramework] = useState<string>('all');
  const [downloadError, setDownloadError] = useState<string>('');

  useEffect(() => {
    fetchReports();
    fetchCompanies();
  }, []);

  const fetchReports = async () => {
    try {
      // Get access token
      const tokenResponse = await fetch('/api/auth/token');
      const { accessToken } = await tokenResponse.json();

      const response = await fetch('http://localhost:3001/api/reports', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch reports');
      
      const data = await response.json();
      setReports(data.reports || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      // Get access token
      const tokenResponse = await fetch('/api/auth/token');
      const { accessToken } = await tokenResponse.json();

      const response = await fetch('http://localhost:3001/api/companies', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch companies');
      
      const data = await response.json();
      setCompanies(data.companies || []);
    } catch (err: any) {
      console.error('Failed to fetch companies:', err);
    }
  };

  const filteredReports = reports.filter(report => {
    if (selectedCompany !== 'all' && report.company_id !== selectedCompany) return false;
    if (selectedFramework !== 'all' && report.framework !== selectedFramework) return false;
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'draft': return 'bg-yellow-100 text-yellow-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const downloadPDF = async (reportId: string) => {
    try {
      setDownloadError(''); // Clear previous errors
      
      // Get access token
      const tokenResponse = await fetch('/api/auth/token');
      const { accessToken } = await tokenResponse.json();

      const response = await fetch(`http://localhost:3001/api/reports/${reportId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to download PDF' }));
        throw new Error(errorData.error || 'Failed to download PDF');
      }

      // Get the blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ESG_Report_${reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setDownloadError(err.message);
      setTimeout(() => setDownloadError(''), 5000); // Clear after 5 seconds
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">ESG Reports</h1>
        <p className="text-gray-600 mt-2">
          View and manage all ESG reports across companies
        </p>
      </div>

      {/* Download Error */}
      {downloadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          <p className="font-semibold">❌ Download Failed</p>
          <p className="text-sm mt-1">{downloadError}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Company
            </label>
            <select 
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Companies</option>
              {companies.map(company => (
                <option key={company.company_id} value={company.company_id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Framework
            </label>
            <select 
              value={selectedFramework}
              onChange={(e) => setSelectedFramework(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Frameworks</option>
              <option value="GRI">GRI</option>
              <option value="SASB">SASB</option>
              <option value="TCFD">TCFD</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            All Reports ({filteredReports.length})
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            <p className="mt-2 text-gray-600">Loading reports...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p className="font-semibold">Error loading reports</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 text-gray-600 px-4 py-8 rounded text-center">
            <p className="text-lg font-medium">No reports found</p>
            <p className="text-sm mt-2">Generate reports from the Companies page</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReports.map((report) => (
              <div key={report.report_id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {report.framework} Report - {report.company_name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Generated {formatDate(report.generated_at)}
                    </p>
                  </div>
                  <span className={`px-3 py-1 text-sm rounded-full font-medium ${getStatusColor(report.status)}`}>
                    {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                  </span>
                </div>
                
                <div className="flex space-x-3">
                  <Link
                    href={`/dashboard/reports/${report.report_id}`}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    View Details
                  </Link>
                  <button 
                    onClick={() => downloadPDF(report.report_id)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    📄 Download PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
