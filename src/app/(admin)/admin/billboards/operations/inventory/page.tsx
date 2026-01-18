'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Package, Plus, Search, Settings, Copy, Wifi, WifiOff, Wrench } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Billboard {
  id: string;
  name: string;
  slug: string;
  address: string;
  status: 'online' | 'offline' | 'maintenance';
  resolution: string;
  pricePerSlot: number;
  apiKey: string;
}

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const { data } = useSWR('/api/v1/admin/billboards?include_inactive=true', fetcher);

  const mockBillboards: Billboard[] = [
    { id: '1', name: 'Plateau Centre', slug: 'plateau-centre', address: "Place de l'Indépendance", status: 'online', resolution: '1080x2160', pricePerSlot: 5000, apiKey: 'bb_xxx' },
    { id: '2', name: 'Almadies', slug: 'almadies', address: 'Route de Ngor', status: 'online', resolution: '1080x2160', pricePerSlot: 7500, apiKey: 'bb_xxx' },
    { id: '3', name: 'VDN', slug: 'vdn', address: 'Voie de Dégagement Nord', status: 'online', resolution: '1080x2160', pricePerSlot: 6000, apiKey: 'bb_xxx' },
    { id: '4', name: 'Médina', slug: 'medina', address: 'Avenue Blaise Diagne', status: 'offline', resolution: '1080x2160', pricePerSlot: 4000, apiKey: 'bb_xxx' },
  ];

  const billboards = data?.billboards || mockBillboards;
  const filtered = billboards.filter((b: Billboard) =>
    b.name.toLowerCase().includes(search.toLowerCase()) || b.address.toLowerCase().includes(search.toLowerCase())
  );

  const statusConfig = {
    online: { icon: Wifi, color: 'text-green-500', bg: 'bg-green-500/10' },
    offline: { icon: WifiOff, color: 'text-red-500', bg: 'bg-red-500/10' },
    maintenance: { icon: Wrench, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight">Billboard Inventory</h2>
          <p className="text-[#9da6b9] mt-1">Manage all digital billboards in the network</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#135bec] text-white rounded-lg font-bold hover:bg-[#135bec]/90 transition-colors">
          <Plus className="h-4 w-4" /> Add Billboard
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: billboards.length },
          { label: 'Online', value: billboards.filter((b: Billboard) => b.status === 'online').length },
          { label: 'Offline', value: billboards.filter((b: Billboard) => b.status === 'offline').length },
          { label: 'Maintenance', value: billboards.filter((b: Billboard) => b.status === 'maintenance').length },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#1c222d] border border-[#282e39] p-4 rounded-xl">
            <p className="text-2xl font-black">{stat.value}</p>
            <p className="text-sm text-[#9da6b9]">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9da6b9]" />
        <input
          type="text"
          placeholder="Search billboards..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#1c222d] border border-[#282e39] rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-[#135bec]/50 focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-[#1c222d] border border-[#282e39] rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#101622] text-[#9da6b9] uppercase text-xs font-bold">
            <tr>
              <th className="px-6 py-4">Billboard</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Resolution</th>
              <th className="px-6 py-4">Price/Slot</th>
              <th className="px-6 py-4">API Key</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#282e39]">
            {filtered.map((billboard: Billboard) => {
              const config = statusConfig[billboard.status];
              const StatusIcon = config.icon;
              return (
                <tr key={billboard.id} className="hover:bg-[#282e39]/30 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold">{billboard.name}</p>
                    <p className="text-xs text-[#9da6b9]">{billboard.address}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-2 ${config.color}`}>
                      <StatusIcon className="h-4 w-4" />
                      <span className="text-xs font-bold capitalize">{billboard.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">{billboard.resolution}</td>
                  <td className="px-6 py-4 font-bold">{billboard.pricePerSlot.toLocaleString()} FCFA</td>
                  <td className="px-6 py-4">
                    <button className="flex items-center gap-2 text-[#9da6b9] hover:text-white transition-colors">
                      <code className="text-xs">bb_•••</code>
                      <Copy className="h-3 w-3" />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-[#282e39] rounded-lg transition-colors">
                      <Settings className="h-4 w-4 text-[#9da6b9]" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
