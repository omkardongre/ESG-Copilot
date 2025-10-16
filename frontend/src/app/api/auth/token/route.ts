import { getAccessToken } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { accessToken } = await getAccessToken();
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No access token available' },
        { status: 401 }
      );
    }
    
    return NextResponse.json({ accessToken });
  } catch (error: any) {
    console.error('Error getting access token:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get access token' },
      { status: 500 }
    );
  }
}
