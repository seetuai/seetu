'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { DollarSign, TrendingUp, Download, Calendar, Search, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function RevenuePage() {
  const { data } = useSWR('/api/v1/admin/billboards/revenue', fetcher);

  const mockStats = { totalRevenue: 45500000, monthlyGrowth: 12.5, activeBillboards: 12 };
  const mockLocations = [
    { name: 'VDN', amount: 22100000, percentage: 90 },
    { name: 'Almadies', amount: 9200000, percentage: 65 },
    { name: 'Parcelles', amount: 13900000, percentage: 75 },
  ];
  const mockPayments = [
    { name: 'Wave', percentage: 65, color: '#135bec' },
    { name: 'Orange Money', percentage: 25, color: '#ff6b00' },
    { name: 'Bank', percentage: 10, color: '#9da6b9' },
  ];
  const mockTransactions = [
    { id: 'STU-8821', date: 'Jan 15, 2024', advertiser: 'Orange Sénégal', amount: 1250000, status: 'completed' },
    { id: 'STU-8819', date: 'Jan 14, 2024', advertiser: 'CFAO Motors', amount: 3400000, status: 'completed' },
    { id: 'STU-8815', date: 'Jan 13, 2024', advertiser: 'Société Générale', amount: 950000, status: 'failed' },
  ];

  const stats = data?.stats || mockStats;
  const locations = data?.revenueByLocation || mockLocations;
  const payments = data?.paymentMethods || mockPayments;
  const transactions = data?.transactions || mockTransactions;

  const statusStyles: Record<string, string> = {
    completed: 'bg-green-500/10 text-green-500',
    failed: 'bg-red-500/10 text-red-500',
    pending: 'bg-amber-500/10 text-amber-500',
    refunded: 'bg-[#9da6b9]/10 text-[#9da6b9]',
  };

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight">Revenue & Financial Reports</h2>
          <p className="text-[#9da6b9] mt-1">Real-time financial tracking for digital billboards</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#135bec] text-white rounded-lg font-bold hover:bg-[#135bec]/90 transition-colors">
          <Download className="h-4 w-4" /> Export Reports
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-[#1c222d] border border-[#282e39] p-6 rounded-xl">
          <p className="text-sm text-[#9da6b9] mb-2">Total Revenue</p>
          <p className="text-3xl font-bold">{(stats.totalRevenue / 1000000).toFixed(1)}M <span className="text-sm text-[#9da6b9]">FCFA</span></p>
        </div>
        <div className="bg-[#1c222d] border border-[#282e39] p-6 rounded-xl">
          <p className="text-sm text-[#9da6b9] mb-2">Monthly Growth</p>
          <p className="text-3xl font-bold flex items-center gap-2">+{stats.monthlyGrowth}% <TrendingUp className="h-5 w-5 text-green-500" /></p>
        </div>
        <div className="bg-[#1c222d] border border-[#282e39] p-6 rounded-xl">
          <p className="text-sm text-[#9da6b9] mb-2">Active Billboards</p>
          <p className="text-3xl font-bold">{stats.activeBillboards}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Revenue by Location */}
        <div className="bg-[#1c222d] border border-[#282e39] p-6 rounded-xl">
          <h3 className="font-bold text-lg mb-4">Revenue by Location</h3>
          <div className="flex items-end justify-between gap-4 h-48 px-2">
            {locations.map((loc: any) => (
              <div key={loc.name} className="flex flex-col items-center gap-2 w-full">
                <div className="w-full bg-[#135bec]/20 rounded-t-lg relative" style={{ height: `${loc.percentage * 1.8}px` }}>
                  <div className="absolute bottom-0 w-full bg-[#135bec] rounded-t-lg" style={{ height: `${loc.percentage}%` }} />
                </div>
                <span className="text-[11px] font-bold text-[#9da6b9] uppercase">{loc.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-[#1c222d] border border-[#282e39] p-6 rounded-xl">
          <h3 className="font-bold text-lg mb-4">Payment Methods</h3>
          <div className="flex items-center justify-around h-48">
            <div
              className="relative size-40 rounded-full flex items-center justify-center"
              style={{ background: `conic-gradient(#135bec 0% 65%, #ff6b00 65% 90%, #9da6b9 90% 100%)` }}
            >
              <div className="size-28 bg-[#1c222d] rounded-full flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-[#9da6b9]">TOP</span>
                <span className="text-sm font-black text-[#135bec]">Wave 65%</span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {payments.map((m: any) => (
                <div key={m.name} className="flex items-center gap-2">
                  <div className="size-3 rounded-full" style={{ backgroundColor: m.color }} />
                  <span className="text-sm">{m.name}</span>
                  <span className="text-sm text-[#9da6b9] ml-auto">{m.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-[#1c222d] border border-[#282e39] rounded-xl overflow-hidden">
        <div className="p-6 border-b border-[#282e39]">
          <h3 className="font-bold text-lg">Recent Transactions</h3>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-[#101622] text-[#9da6b9] uppercase text-xs font-bold">
            <tr>
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Advertiser</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#282e39]">
            {transactions.map((tx: any) => (
              <tr key={tx.id} className="hover:bg-[#282e39]/30 transition-colors">
                <td className="px-6 py-4 font-mono">#{tx.id}</td>
                <td className="px-6 py-4 text-[#9da6b9]">{tx.date}</td>
                <td className="px-6 py-4 font-semibold">{tx.advertiser}</td>
                <td className="px-6 py-4 font-bold">{tx.amount.toLocaleString()} FCFA</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${statusStyles[tx.status]}`}>
                    {tx.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
