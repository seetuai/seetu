'use client';

import { useState } from 'react';
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
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-3xl font-black tracking-tight">Operations Dashboard</h2>
        <p className="text-[#9da6b9] mt-1">Real-time overview of the Dakar billboard network</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[#1c222d] border border-[#282e39] p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <Monitor className="h-6 w-6 text-[#135bec]" />
            <span className="text-xs font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded">LIVE</span>
          </div>
          <p className="text-4xl font-black">{s.billboards?.online || 0}/{s.billboards?.total || 0}</p>
          <p className="text-sm text-[#9da6b9] mt-1">Billboards Online</p>
        </div>

        <div className="bg-[#1c222d] border border-[#282e39] p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <Shield className="h-6 w-6 text-amber-500" />
            {(s.content?.pendingModeration || 0) > 0 && (
              <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded">ACTION</span>
            )}
          </div>
          <p className="text-4xl font-black">{s.content?.pendingModeration || 0}</p>
          <p className="text-sm text-[#9da6b9] mt-1">Pending Moderation</p>
        </div>

        <div className="bg-[#1c222d] border border-[#282e39] p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <DollarSign className="h-6 w-6 text-green-500" />
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-4xl font-black">{((s.revenue?.thisMonth || 0) / 1000000).toFixed(1)}M</p>
          <p className="text-sm text-[#9da6b9] mt-1">Revenue This Month (FCFA)</p>
        </div>

        <div className="bg-[#1c222d] border border-[#282e39] p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <Play className="h-6 w-6 text-[#135bec]" />
          </div>
          <p className="text-4xl font-black">{s.queue?.completedToday || 0}</p>
          <p className="text-sm text-[#9da6b9] mt-1">Plays Today</p>
        </div>
      </div>

      {/* Map Placeholder & Moderation Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#1c222d] border border-[#282e39] rounded-xl p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-[#135bec]" />
            Network Map - Dakar
          </h3>
          <div className="aspect-[16/9] bg-[#101622] rounded-lg flex items-center justify-center">
            <p className="text-[#9da6b9]">Map integration coming soon</p>
          </div>
        </div>

        <div className="bg-[#1c222d] border border-[#282e39] rounded-xl p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Moderation Queue
          </h3>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-[#101622] rounded-lg">
                <div className="size-12 bg-[#282e39] rounded" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">Content #{i}</p>
                  <p className="text-xs text-[#9da6b9]">Awaiting review</p>
                </div>
                <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded">MEDIUM</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
