import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://seetu.app',
  'https://www.seetu.app',
  'https://seetu.sn',
  'https://www.seetu.sn',
  // Development origins
  ...(process.env.NODE_ENV !== 'production' ? [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
  ] : []),
];

function getCorsOrigin(request: NextRequest): string | null {
  const origin = request.headers.get('origin');

  // No origin header = same-origin request, allow it
  if (!origin) return null;

  // Check if origin is in allowlist
  if (ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }

  // Allow custom app URL from env
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && origin === appUrl) {
    return origin;
  }

  // In development, be more permissive
  if (process.env.NODE_ENV !== 'production') {
    return origin;
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const corsOrigin = getCorsOrigin(request);

  // Handle CORS preflight requests for API routes
  if (request.method === 'OPTIONS' && request.nextUrl.pathname.startsWith('/api/')) {
    const headers: Record<string, string> = {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    if (corsOrigin) {
      headers['Access-Control-Allow-Origin'] = corsOrigin;
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    return new NextResponse(null, { status: 200, headers });
  }

  const response = await updateSession(request);

  // Add CORS headers to API responses
  if (request.nextUrl.pathname.startsWith('/api/') && corsOrigin) {
    response.headers.set('Access-Control-Allow-Origin', corsOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
