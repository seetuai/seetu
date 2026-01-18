'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Monitor, Wifi, WifiOff, Wrench, Play, Search, LayoutGrid, List } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Billboard {
  id: string;
  name: string;
  address: string;
  status: 'online' | 'offline' | 'maintenance';
  currentContent: { title: string; advertiser: string } | null;
  queueCount: number;
  playsToday: number;
}

export default function LiveMonitorPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');

  const { data } = useSWR('/api/v1/admin/billboards/live', fetcher, { refreshInterval: 5000 });

  const mockBillboards: Billboard[] = [
    { id: '1', name: 'Plateau Centre', address: "Place de l'Indépendance", status: 'online', currentContent: { title: 'Orange 5G', advertiser: 'Orange Senegal' }, queueCount: 12, playsToday: 156 },
    { id: '2', name: 'Almadies', address: 'Route de Ngor', status: 'online', currentContent: { title: 'Nike Air Max', advertiser: 'Nike' }, queueCount: 8, playsToday: 134 },
    { id: '3', name: 'VDN', address: 'Voie de Dégagement Nord', status: 'online', currentContent: { title: 'CBAO Banking', advertiser: 'CBAO' }, queueCount: 15, playsToday: 201 },
    { id: '4', name: 'Médina', address: 'Avenue Blaise Diagne', status: 'offline', currentContent: null, queueCount: 0, playsToday: 45 },
    { id: '5', name: 'Parcelles Assainies', address: 'Unité 17', status: 'maintenance', currentContent: null, queueCount: 5, playsToday: 89 },
  ];

  const billboards = data?.billboards || mockBillboards;
  const filtered = filter === 'all' ? billboards : billboards.filter((b: Billboard) => b.status === filter);

  const statusConfig = {
    online: { icon: Wifi, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Online' },
    offline: { icon: WifiOff, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Offline' },
    maintenance: { icon: Wrench, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Maintenance' },
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight">Live Network Monitor</h2>
          <p className="text-[#9da6b9] mt-1">Real-time status of all billboards in the Dakar network</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-[#1c222d] rounded-lg p-1">
            {(['all', 'online', 'offline'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === f ? 'bg-[#135bec] text-white' : 'text-[#9da6b9] hover:text-white'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex bg-[#1c222d] rounded-lg p-1">
            <button onClick={() => setView('grid')} className={`p-2 rounded-md ${view === 'grid' ? 'bg-[#135bec]' : ''}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setView('list')} className={`p-2 rounded-md ${view === 'list' ? 'bg-[#135bec]' : ''}`}>
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className={view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
        {filtered.map((billboard: Billboard) => {
          const config = statusConfig[billboard.status];
          const StatusIcon = config.icon;

          return (
            <div key={billboard.id} className="bg-[#1c222d] border border-[#282e39] rounded-xl p-6 hover:border-[#135bec]/50 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg">{billboard.name}</h3>
                  <p className="text-sm text-[#9da6b9]">{billboard.address}</p>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${config.bg}`}>
                  <StatusIcon className={`h-4 w-4 ${config.color}`} />
                  <span className={`text-xs font-bold ${config.color}`}>{config.label}</span>
                </div>
              </div>

              {billboard.currentContent ? (
                <div className="mb-4 p-3 bg-[#101622] rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Play className="h-3 w-3 text-[#135bec]" />
                    <span className="text-xs text-[#135bec] font-bold">NOW PLAYING</span>
                  </div>
                  <p className="text-sm font-medium truncate">{billboard.currentContent.title}</p>
                  <p className="text-xs text-[#9da6b9]">{billboard.currentContent.advertiser}</p>
                </div>
              ) : (
                <div className="mb-4 p-3 bg-[#101622] rounded-lg">
                  <p className="text-sm text-[#9da6b9]">No content playing</p>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-[#9da6b9]">Queue: <span className="text-white font-bold">{billboard.queueCount}</span></span>
                <span className="text-[#9da6b9]">Today: <span className="text-white font-bold">{billboard.playsToday}</span> plays</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
