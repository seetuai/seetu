'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Monitor, Wifi, WifiOff, Wrench, Play, LayoutGrid, List } from 'lucide-react';

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
    online: { icon: Wifi, color: 'text-green-600', bg: 'bg-green-100', label: 'Online' },
    offline: { icon: WifiOff, color: 'text-red-600', bg: 'bg-red-100', label: 'Offline' },
    maintenance: { icon: Wrench, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Maintenance' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Live Network Monitor</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Real-time status of all billboards in the Dakar network</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            {(['all', 'online', 'offline'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === f ? 'bg-red-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button onClick={() => setView('grid')} className={`p-2 rounded-md ${view === 'grid' ? 'bg-red-600 text-white' : 'text-slate-600'}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setView('list')} className={`p-2 rounded-md ${view === 'list' ? 'bg-red-600 text-white' : 'text-slate-600'}`}>
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className={view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
        {filtered.map((billboard: Billboard) => {
          const config = statusConfig[billboard.status];
          const StatusIcon = config.icon;

          return (
            <div key={billboard.id} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:border-red-300 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">{billboard.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{billboard.address}</p>
                </div>
                <div className={`flex items-center gap-2 px-2 py-1 rounded-full ${config.bg}`}>
                  <StatusIcon className={`h-3 w-3 ${config.color}`} />
                  <span className={`text-xs font-bold ${config.color}`}>{config.label}</span>
                </div>
              </div>

              {billboard.currentContent ? (
                <div className="mb-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-1">
                    <Play className="h-3 w-3 text-red-600" />
                    <span className="text-xs text-red-600 font-bold">NOW PLAYING</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{billboard.currentContent.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{billboard.currentContent.advertiser}</p>
                </div>
              ) : (
                <div className="mb-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-slate-500 dark:text-slate-400">No content playing</p>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Queue: <span className="text-slate-900 dark:text-white font-bold">{billboard.queueCount}</span></span>
                <span className="text-slate-500 dark:text-slate-400">Today: <span className="text-slate-900 dark:text-white font-bold">{billboard.playsToday}</span> plays</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
