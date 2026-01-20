import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import prisma from '@/lib/prisma';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP to prevent abuse
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown';
    const rateLimitKey = getRateLimitKey(null, 'auth-signup', ip);
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS.auth);
    const rateLimitError = rateLimitResponse(rateLimit);
    if (rateLimitError) {
      return rateLimitError;
    }

    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Create user with Supabase
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (!data.user || !data.session) {
      return NextResponse.json(
        { error: 'Signup failed - please check your email to confirm your account' },
        { status: 400 }
      );
    }

    // Create user in database
    const user = await prisma.user.create({
      data: {
        authId: data.user.id,
        email: data.user.email!,
        name: name || data.user.email?.split('@')[0],
        avatarUrl: null,
        creditUnits: 300,
      },
    });

    await prisma.creditLedger.create({
      data: {
        userId: user.id,
        delta: 300,
        balanceAfter: 300,
        reason: 'free_trial',
        description: 'Welcome credits',
      },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        creditUnits: user.creditUnits,
        createdAt: user.createdAt.toISOString(),
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
