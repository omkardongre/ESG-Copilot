'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/api/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl">🌱</span>
              <h1 className="text-2xl font-bold text-green-700">ESG Copilot</h1>
            </Link>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{user.email}</span>
              <a
                href="/api/auth/logout"
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Logout
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <Link
              href="/dashboard/companies"
              className="px-3 py-4 text-sm font-medium text-gray-700 hover:text-green-600 border-b-2 border-transparent hover:border-green-600"
            >
              Companies
            </Link>
            <Link
              href="/dashboard/regulations"
              className="px-3 py-4 text-sm font-medium text-gray-700 hover:text-green-600 border-b-2 border-transparent hover:border-green-600"
            >
              Regulations
            </Link>
            <Link
              href="/dashboard/esg-data"
              className="px-3 py-4 text-sm font-medium text-gray-700 hover:text-green-600 border-b-2 border-transparent hover:border-green-600"
            >
              ESG Data
            </Link>
            <Link
              href="/dashboard/reports"
              className="px-3 py-4 text-sm font-medium text-gray-700 hover:text-green-600 border-b-2 border-transparent hover:border-green-600"
            >
              Reports
            </Link>
            <Link
              href="/dashboard/chat"
              className="px-3 py-4 text-sm font-medium text-gray-700 hover:text-green-600 border-b-2 border-transparent hover:border-green-600"
            >
              AI Chat
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
