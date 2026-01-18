/**
 * GET /api/v1/admin/billboards/revenue
 * Admin: Revenue statistics and transactions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

const SUPERADMIN_EMAILS = ['admin@seetu.sn', 'ali@seetu.sn'];

async function isAdmin(request: NextRequest): Promise<boolean> {
  const supabase = await createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;
  return SUPERADMIN_EMAILS.includes(user.email);
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [totalRevenue, monthlyRevenue, billboardCount] = await Promise.all([
      prisma.billboardPayment.aggregate({ _sum: { amountCfa: true }, where: { status: 'completed' } }),
      prisma.billboardPayment.aggregate({ _sum: { amountCfa: true }, where: { status: 'completed', paidAt: { gte: startOfMonth } } }),
      prisma.billboard.count({ where: { isActive: true } }),
    ]);

    const paymentMethods = await prisma.billboardPayment.groupBy({
      by: ['paymentMethod'],
      _sum: { amountCfa: true },
      where: { status: 'completed' },
    });

    const total = paymentMethods.reduce((s, p) => s + (p._sum.amountCfa || 0), 0);
    const methods = paymentMethods.map((p) => ({
      name: p.paymentMethod === 'wave' ? 'Wave' : p.paymentMethod === 'orange_money' ? 'Orange Money' : 'Bank',
      percentage: total > 0 ? Math.round(((p._sum.amountCfa || 0) / total) * 100) : 0,
      color: p.paymentMethod === 'wave' ? '#135bec' : p.paymentMethod === 'orange_money' ? '#ff6b00' : '#9da6b9',
    }));

    const transactions = await prisma.billboardPayment.findMany({
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      stats: {
        totalRevenue: totalRevenue._sum.amountCfa || 0,
        monthlyRevenue: monthlyRevenue._sum.amountCfa || 0,
        monthlyGrowth: 12.5,
        activeBillboards: billboardCount,
      },
      revenueByLocation: [],
      paymentMethods: methods,
      transactions: transactions.map((t) => ({
        id: t.id.slice(0, 8).toUpperCase(),
        date: t.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        advertiser: t.whatsappPhone || t.user?.email || 'Unknown',
        amount: t.amountCfa,
        status: t.status,
      })),
    });
  } catch (error) {
    console.error('[ADMIN] GET /billboards/revenue error:', error);
    return NextResponse.json({ error: 'Failed to fetch revenue' }, { status: 500 });
  }
}
