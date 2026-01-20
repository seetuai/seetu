'use client';

import useSWR from 'swr';
import { Monitor, Shield, DollarSign, Play, TrendingUp, MapPin, AlertCircle } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function OperationsDashboard() {
  const { data: stats } = useSWR('/api/v1/admin/billboards/stats', fetcher, { refreshInterval: 30000 });

  const mockStats = {
    billboards: { total: 12, online: 10, offline: 2 },
    content: { pendingModeration: 5 },
    queue: { completedToday: 847 },
    revenue: { thisMonth: 45500000 },
  };

  const s = stats || mockStats;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <Monitor className="h-5 w-5 text-blue-600" />
            <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded">LIVE</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{s.billboards?.online || 0}/{s.billboards?.total || 0}</p>
          <p className="text-sm text-slate-500">Billboards Online</p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <Shield className="h-5 w-5 text-amber-500" />
            {(s.content?.pendingModeration || 0) > 0 && (
              <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded">ACTION</span>
            )}
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{s.content?.pendingModeration || 0}</p>
          <p className="text-sm text-slate-500">Pending Moderation</p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <TrendingUp className="h-4 w-4 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{((s.revenue?.thisMonth || 0) / 1000000).toFixed(1)}M</p>
          <p className="text-sm text-slate-500">Revenue This Month (FCFA)</p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <Play className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{s.queue?.completedToday || 0}</p>
          <p className="text-sm text-slate-500">Plays Today</p>
        </div>
      </div>

      {/* Map & Queue Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-600" />
            Network Map - Dakar
          </h3>
          <div className="aspect-[16/9] bg-slate-100 dark:bg-slate-900 rounded-lg flex items-center justify-center">
            <p className="text-slate-500">Map integration coming soon</p>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Moderation Queue
          </h3>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                <div className="size-10 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">Content #{i}</p>
                  <p className="text-xs text-slate-500">Awaiting review</p>
                </div>
                <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded">MEDIUM</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
