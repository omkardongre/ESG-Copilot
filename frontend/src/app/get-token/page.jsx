'use client';

import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

export default function GetTokenPage() {
  const { getAccessTokenSilently, isAuthenticated, loginWithRedirect } = useAuth0();
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      getToken();
    }
  }, [isAuthenticated]);

  const getToken = async () => {
    try {
      const accessToken = await getAccessTokenSilently();
      setToken(accessToken);
    } catch (error) {
      console.error('Error getting token:', error);
    }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>Get JWT Token</CardTitle>
            <CardDescription>Login to get your access token</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => loginWithRedirect()}>Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle>Your JWT Access Token</CardTitle>
          <CardDescription>Use this token for API testing with curl or Postman</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {token ? (
            <>
              <div className="bg-gray-100 p-4 rounded-lg font-mono text-sm break-all">
                {token}
              </div>
              
              <Button onClick={copyToken} className="w-full">
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Token
                  </>
                )}
              </Button>

              <div className="mt-6 space-y-2">
                <h3 className="font-semibold">Usage Example:</h3>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">
{`curl -X GET http://localhost:3001/api/companies \\
  -H "Authorization: Bearer ${token.substring(0, 20)}..."`}
                </pre>
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Token Info:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Token expires in ~24 hours</li>
                  <li>• Use in Authorization header: Bearer [token]</li>
                  <li>• Refresh this page to get a new token if expired</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading token...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
