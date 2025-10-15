'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';

interface Company {
  company_id: string;
  name: string;
  industry: string;
  country: string;
  employees?: number;
  revenue?: number;
}

export default function CompaniesPage() {
  const { user } = useUser();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/companies`, {
        headers: {
          'Authorization': `Bearer ${user?.sub}`, // In production, use actual JWT
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch companies');
      }

      const data = await response.json();
      setCompanies(data.companies || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading companies...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Companies</h1>
        <p className="text-gray-600 mt-2">
          Manage company profiles and discover new ESG compliance clients
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
          <p className="text-sm mt-2">
            Make sure the backend API is running on {process.env.NEXT_PUBLIC_API_URL}
          </p>
        </div>
      )}

      {/* Demo Notice */}
      <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-6">
        <p className="font-semibold">🔐 Auth0 Feature: Authenticate the User</p>
        <p className="text-sm mt-1">
          You're logged in as <strong>{user?.email}</strong>. This page is protected by Auth0 Universal Login.
        </p>
      </div>

      {/* Companies Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {companies.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500 mb-4">No companies found</p>
            <p className="text-sm text-gray-400">
              Use the API to create companies or wait for backend setup
            </p>
          </div>
        ) : (
          companies.map((company) => (
            <div
              key={company.company_id}
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition"
            >
              <h3 className="text-lg font-semibold mb-2">{company.name}</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <p>
                  <span className="font-medium">Industry:</span> {company.industry}
                </p>
                <p>
                  <span className="font-medium">Country:</span> {company.country}
                </p>
                {company.employees && (
                  <p>
                    <span className="font-medium">Employees:</span>{' '}
                    {company.employees.toLocaleString()}
                  </p>
                )}
              </div>
              <div className="mt-4 flex space-x-2">
                <button className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                  View Details
                </button>
                <button className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300">
                  Edit
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
