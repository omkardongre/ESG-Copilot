'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { ConfirmModal } from '@/components/Modal';

interface Company {
  company_id: string;
  name: string;
  industry: string;
  country: string;
  city?: string;
  website?: string;
  employees?: number;
  revenue?: number;
}

export default function CompaniesPage() {
  const { user } = useUser();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<{ id: string; name: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    country: '',
    city: '',
    website: '',
    employees: '',
    revenue: '',
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      
      // Get access token from Auth0
      const tokenResponse = await fetch('/api/auth/token');
      const { accessToken } = await tokenResponse.json();
      
      if (!accessToken) {
        throw new Error('No access token available');
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/companies`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch companies');
      }

      const data = await response.json();
      setCompanies(data.companies || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      const tokenResponse = await fetch('/api/auth/token');
      const { accessToken } = await tokenResponse.json();

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/companies`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          industry: formData.industry,
          country: formData.country,
          city: formData.city || undefined,
          website: formData.website || undefined,
          employees: formData.employees ? parseInt(formData.employees) : undefined,
          revenue: formData.revenue ? parseInt(formData.revenue) : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to create company');
      }

      // Success - reset form and refresh list
      setFormData({ name: '', industry: '', country: '', city: '', website: '', employees: '', revenue: '' });
      setShowForm(false);
      await fetchCompanies();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleEditCompany = (company: Company) => {
    setEditingCompanyId(company.company_id);
    setFormData({
      name: company.name,
      industry: company.industry || '',
      country: company.country || '',
      city: company.city || '',
      website: company.website || '',
      employees: company.employees?.toString() || '',
      revenue: company.revenue?.toString() || '',
    });
    setShowForm(true);
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditing(true);
    setError('');
    setSuccessMessage('');

    try {
      const tokenResponse = await fetch('/api/auth/token');
      const { accessToken } = await tokenResponse.json();

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/companies/${editingCompanyId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          industry: formData.industry,
          country: formData.country,
          city: formData.city || undefined,
          website: formData.website || undefined,
          employees: formData.employees ? parseInt(formData.employees) : undefined,
          revenue: formData.revenue ? parseInt(formData.revenue) : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.message || errorData.details || errorData.error || 'Failed to update company');
      }

      const result = await response.json();

      // Success - reset form and refresh list
      setFormData({ name: '', industry: '', country: '', city: '', website: '', employees: '', revenue: '' });
      setShowForm(false);
      setEditingCompanyId(null);
      await fetchCompanies();
      
      // Show success message
      setSuccessMessage(`Successfully updated "${result.company?.name || formData.name}"`);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(''), 8000);
    } finally {
      setEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setFormData({ name: '', industry: '', country: '', city: '', website: '', employees: '', revenue: '' });
    setShowForm(false);
    setEditingCompanyId(null);
  };

  const handleDeleteCompany = async () => {
    if (!companyToDelete) return;

    const { id: companyId, name: companyName } = companyToDelete;
    setDeleting(companyId);
    setError('');
    setSuccessMessage('');

    try {
      // Get access token from Auth0
      const tokenResponse = await fetch('/api/auth/token');
      const { accessToken } = await tokenResponse.json();

      const response = await fetch(`http://localhost:3001/api/companies/${companyId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(data.message || data.details || data.error || 'Failed to delete company');
      }

      const result = await response.json();
      console.log('✅ Company deleted:', result);

      // Success - refresh list
      await fetchCompanies();
      
      // Show success message in UI
      setSuccessMessage(`Successfully deleted "${companyName}" and associated data`);
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      console.error('❌ Delete error:', err);
      setError(err.message);
      
      // Auto-hide error message after 8 seconds
      setTimeout(() => setError(''), 8000);
    } finally {
      setDeleting(null);
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

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6 flex items-center justify-between">
          <div>
            <p className="font-semibold">✅ Success</p>
            <p>{successMessage}</p>
          </div>
          <button 
            onClick={() => setSuccessMessage('')}
            className="text-green-700 hover:text-green-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6 flex items-center justify-between">
          <div>
            <p className="font-semibold">❌ Error</p>
            <p>{error}</p>
          </div>
          <button 
            onClick={() => setError('')}
            className="text-red-700 hover:text-red-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Demo Notice */}
      <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-6">
        <p className="font-semibold">🔐 Auth0 Feature: Authenticate the User</p>
        <p className="text-sm mt-1">
          You're logged in as <strong>{user?.email}</strong>. This page is protected by Auth0 Universal Login.
        </p>
      </div>

      {/* Create Company Button */}
      <div className="mb-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold"
        >
          {showForm ? '✕ Cancel' : '+ Create Company'}
        </button>
      </div>

      {/* Create/Edit Company Form */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-bold mb-4">
            {editingCompanyId ? 'Edit Company' : 'Create New Company'}
          </h2>
          <form onSubmit={editingCompanyId ? handleUpdateCompany : handleCreateCompany} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="e.g., GreenTech Solutions"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Industry *
                </label>
                <input
                  type="text"
                  required
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., Technology"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country *
                </label>
                <input
                  type="text"
                  required
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., United States"
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City (optional)
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., Austin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website (optional)
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., https://www.tesla.com"
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employees (optional)
                </label>
                <input
                  type="number"
                  value={formData.employees}
                  onChange={(e) => setFormData({ ...formData, employees: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., 127855"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Annual Revenue (optional)
                </label>
                <input
                  type="number"
                  value={formData.revenue}
                  onChange={(e) => setFormData({ ...formData, revenue: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., 96773000000"
                />
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={creating || editing}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 font-semibold"
              >
                {editingCompanyId 
                  ? (editing ? 'Updating...' : 'Update Company')
                  : (creating ? 'Creating...' : 'Create Company')
                }
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Companies Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {companies.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500 mb-4">No companies found</p>
            <p className="text-sm text-gray-400">
              Click "Create Company" above to add your first company
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
                <a
                  href={`/dashboard/companies/${company.company_id}`}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 inline-block text-center"
                >
                  View Details
                </a>
                <button 
                  onClick={() => handleEditCompany(company)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  disabled={deleting === company.company_id}
                >
                  Edit
                </button>
                <button 
                  onClick={() => {
                    setCompanyToDelete({ id: company.company_id, name: company.name });
                    setShowDeleteConfirm(true);
                  }}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={deleting === company.company_id}
                >
                  {deleting === company.company_id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setCompanyToDelete(null);
        }}
        onConfirm={handleDeleteCompany}
        title="Delete Company"
        message={`Are you sure you want to delete "${companyToDelete?.name}"?\n\nThis will also delete:\n• All associated reports\n• All RAG documents in Pinecone\n• All ESG data\n\nThis action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="error"
      />
    </div>
  );
}
