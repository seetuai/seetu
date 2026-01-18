'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Users, Search, Plus, MessageCircle, Globe, Star, TrendingUp } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Advertiser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  type: 'platform' | 'whatsapp';
  totalSpent: number;
  campaigns: number;
  status: 'active' | 'vip' | 'suspended';
  lastActivity: string;
}

export default function AdvertisersPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const mockAdvertisers: Advertiser[] = [
    { id: '1', name: 'Orange Sénégal', email: 'marketing@orange.sn', type: 'platform', totalSpent: 15000000, campaigns: 24, status: 'vip', lastActivity: '2 hours ago' },
    { id: '2', name: 'CFAO Motors', email: 'pub@cfao.com', type: 'platform', totalSpent: 8500000, campaigns: 12, status: 'active', lastActivity: '1 day ago' },
    { id: '3', name: 'Mamadou Diallo', phone: '+221 77 123 4567', type: 'whatsapp', totalSpent: 150000, campaigns: 2, status: 'active', lastActivity: '3 days ago' },
    { id: '4', name: 'Teranga Shop', phone: '+221 70 987 6543', type: 'whatsapp', totalSpent: 75000, campaigns: 1, status: 'suspended', lastActivity: '1 week ago' },
  ];

  const advertisers = mockAdvertisers;
  const filtered = advertisers.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.email?.toLowerCase().includes(search.toLowerCase()) ||
    a.phone?.includes(search)
  );

  const statusStyles = {
    vip: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    active: 'bg-green-500/10 text-green-500 border-green-500/20',
    suspended: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight">Advertiser CRM</h2>
          <p className="text-[#9da6b9] mt-1">Manage platform users and WhatsApp customers</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#135bec] text-white rounded-lg font-bold hover:bg-[#135bec]/90 transition-colors">
          <Plus className="h-4 w-4" /> Add Advertiser
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#1c222d] border border-[#282e39] p-4 rounded-xl">
          <p className="text-2xl font-black">{advertisers.length}</p>
          <p className="text-sm text-[#9da6b9]">Total Advertisers</p>
        </div>
        <div className="bg-[#1c222d] border border-[#282e39] p-4 rounded-xl">
          <p className="text-2xl font-black">{(advertisers.reduce((s, a) => s + a.totalSpent, 0) / 1000000).toFixed(1)}M</p>
          <p className="text-sm text-[#9da6b9]">Total Revenue (FCFA)</p>
        </div>
        <div className="bg-[#1c222d] border border-[#282e39] p-4 rounded-xl">
          <p className="text-2xl font-black">{advertisers.reduce((s, a) => s + a.campaigns, 0)}</p>
          <p className="text-sm text-[#9da6b9]">Total Campaigns</p>
        </div>
        <div className="bg-[#1c222d] border border-[#282e39] p-4 rounded-xl">
          <p className="text-2xl font-black">{advertisers.filter((a) => a.type === 'whatsapp').length}</p>
          <p className="text-sm text-[#9da6b9]">WhatsApp Leads</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9da6b9]" />
        <input
          type="text"
          placeholder="Search advertisers..."
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
              <th className="px-6 py-4">Advertiser</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Total Spent</th>
              <th className="px-6 py-4">Campaigns</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Last Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#282e39]">
            {filtered.map((advertiser) => (
              <tr
                key={advertiser.id}
                onClick={() => setSelected(advertiser.id)}
                className={`hover:bg-[#282e39]/30 transition-colors cursor-pointer ${selected === advertiser.id ? 'bg-[#135bec]/10' : ''}`}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-[#135bec]/20 flex items-center justify-center text-[#135bec] font-bold">
                      {advertiser.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold flex items-center gap-2">
                        {advertiser.name}
                        {advertiser.status === 'vip' && <Star className="h-3 w-3 text-purple-400 fill-purple-400" />}
                      </p>
                      <p className="text-xs text-[#9da6b9]">{advertiser.email || advertiser.phone}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`flex items-center gap-1.5 text-xs font-bold ${advertiser.type === 'platform' ? 'text-[#135bec]' : 'text-green-500'}`}>
                    {advertiser.type === 'platform' ? <Globe className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />}
                    {advertiser.type === 'platform' ? 'Platform' : 'WhatsApp'}
                  </span>
                </td>
                <td className="px-6 py-4 font-bold">{advertiser.totalSpent.toLocaleString()} FCFA</td>
                <td className="px-6 py-4">{advertiser.campaigns}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold border ${statusStyles[advertiser.status]}`}>
                    {advertiser.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-[#9da6b9]">{advertiser.lastActivity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
