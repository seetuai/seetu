'use client';

import useSWR from 'swr';
import { TrendingUp, Download } from 'lucide-react';

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
    { name: 'Wave', percentage: 65, color: '#dc2626' },
    { name: 'Orange Money', percentage: 25, color: '#ff6b00' },
    { name: 'Bank', percentage: 10, color: '#94a3b8' },
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
    completed: 'bg-green-100 text-green-600',
    failed: 'bg-red-100 text-red-600',
    pending: 'bg-amber-100 text-amber-600',
    refunded: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Revenue & Financial Reports</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Real-time financial tracking for digital billboards</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors">
          <Download className="h-4 w-4" /> Export Reports
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-lg">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Total Revenue</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{(stats.totalRevenue / 1000000).toFixed(1)}M <span className="text-sm text-slate-500">FCFA</span></p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-lg">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Monthly Growth</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">+{stats.monthlyGrowth}% <TrendingUp className="h-5 w-5 text-green-500" /></p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-lg">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Active Billboards</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.activeBillboards}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Revenue by Location */}
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-lg">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Revenue by Location</h3>
          <div className="flex items-end justify-between gap-4 h-48 px-2">
            {locations.map((loc: any) => (
              <div key={loc.name} className="flex flex-col items-center gap-2 w-full">
                <div className="w-full bg-red-100 rounded-t-lg relative" style={{ height: `${loc.percentage * 1.8}px` }}>
                  <div className="absolute bottom-0 w-full bg-red-600 rounded-t-lg" style={{ height: `${loc.percentage}%` }} />
                </div>
                <span className="text-[11px] font-bold text-slate-500 uppercase">{loc.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-lg">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Payment Methods</h3>
          <div className="flex items-center justify-around h-48">
            <div
              className="relative size-40 rounded-full flex items-center justify-center"
              style={{ background: `conic-gradient(#dc2626 0% 65%, #ff6b00 65% 90%, #94a3b8 90% 100%)` }}
            >
              <div className="size-28 bg-slate-50 dark:bg-slate-800 rounded-full flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-slate-500">TOP</span>
                <span className="text-sm font-black text-red-600">Wave 65%</span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {payments.map((m: any) => (
                <div key={m.name} className="flex items-center gap-2">
                  <div className="size-3 rounded-full" style={{ backgroundColor: m.color }} />
                  <span className="text-sm text-slate-900 dark:text-white">{m.name}</span>
                  <span className="text-sm text-slate-500 ml-auto">{m.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">Recent Transactions</h3>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 uppercase text-xs font-bold">
            <tr>
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Advertiser</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {transactions.map((tx: any) => (
              <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-300">#{tx.id}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{tx.date}</td>
                <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{tx.advertiser}</td>
                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{tx.amount.toLocaleString()} FCFA</td>
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
