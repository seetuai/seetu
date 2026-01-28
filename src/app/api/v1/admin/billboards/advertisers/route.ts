/**
 * GET /api/v1/admin/billboards/advertisers
 * Admin: List all advertisers with verification status and spending stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

const SUPERADMIN_EMAILS = (process.env.SUPERADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;
  return SUPERADMIN_EMAILS.includes(user.email);
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get all WhatsApp sessions (advertisers)
    const sessions = await prisma.whatsAppSession.findMany({
      orderBy: { lastMessageAt: 'desc' },
      select: {
        id: true,
        phone: true,
        name: true,
        state: true,
        isVerified: true,
        verifiedAt: true,
        idDocPath: true,
        lastMessageAt: true,
        createdAt: true,
      },
    });

    // Get spending stats grouped by phone
    const payments = await prisma.billboardPayment.groupBy({
      by: ['whatsappPhone'],
      where: {
        whatsappPhone: { not: null },
        status: 'completed',
      },
      _sum: { amountCfa: true },
      _count: true,
    });

    const paymentMap = new Map(
      payments.map(p => [p.whatsappPhone!, { totalSpent: p._sum.amountCfa || 0, campaigns: p._count }])
    );

    // Get platform users with billboard activity
    const platformUsers = await prisma.user.findMany({
      where: {
        billboardPayments: { some: {} },
      },
      select: {
        id: true,
        email: true,
        name: true,
        _count: { select: { billboardPayments: true } },
        billboardPayments: {
          where: { status: 'completed' },
          select: { amountCfa: true },
        },
      },
    });

    // Build advertiser list
    const advertisers = [
      // WhatsApp advertisers
      ...sessions.map(s => {
        const stats = paymentMap.get(s.phone) || { totalSpent: 0, campaigns: 0 };
        return {
          id: s.id,
          name: s.name || s.phone,
          phone: s.phone,
          type: 'whatsapp' as const,
          totalSpent: stats.totalSpent,
          campaigns: stats.campaigns,
          status: stats.totalSpent > 500000 ? 'vip' as const : 'active' as const,
          lastActivity: s.lastMessageAt.toISOString(),
          isVerified: s.isVerified,
          verifiedAt: s.verifiedAt?.toISOString() || null,
          hasIdDoc: !!s.idDocPath,
        };
      }),
      // Platform advertisers
      ...platformUsers.map(u => {
        const totalSpent = u.billboardPayments.reduce((sum, p) => sum + p.amountCfa, 0);
        return {
          id: u.id,
          name: u.name || u.email,
          email: u.email,
          type: 'platform' as const,
          totalSpent,
          campaigns: u._count.billboardPayments,
          status: totalSpent > 500000 ? 'vip' as const : 'active' as const,
          lastActivity: new Date().toISOString(),
          isVerified: true, // Platform users are verified via email
          verifiedAt: null,
          hasIdDoc: false,
        };
      }),
    ];

    return NextResponse.json({ advertisers });
  } catch (error) {
    console.error('[ADMIN] Advertisers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
