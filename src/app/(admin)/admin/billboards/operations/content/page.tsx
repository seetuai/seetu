'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { FolderOpen, Search, Filter, Grid, List, Play, Image, CheckCircle, Clock, XCircle } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ContentItem {
  id: string;
  type: 'video' | 'image';
  advertiser: string;
  status: 'ready' | 'processing' | 'rejected';
  createdAt: string;
  durationSeconds?: number;
}

export default function ContentLibraryPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState<'all' | 'ready' | 'processing' | 'rejected'>('all');

  const { data } = useSWR('/api/v1/admin/billboards/content', fetcher);

  const mockContent: ContentItem[] = [
    { id: '1', type: 'video', advertiser: 'Orange Senegal', status: 'ready', createdAt: '2 hours ago', durationSeconds: 15 },
    { id: '2', type: 'video', advertiser: 'Nike', status: 'ready', createdAt: '5 hours ago', durationSeconds: 30 },
    { id: '3', type: 'image', advertiser: 'CBAO', status: 'processing', createdAt: '1 day ago' },
    { id: '4', type: 'video', advertiser: 'Local Business', status: 'rejected', createdAt: '2 days ago', durationSeconds: 45 },
  ];

  const content = data?.content || mockContent;
  const filtered = filter === 'all' ? content : content.filter((c: ContentItem) => c.status === filter);

  const statusConfig = {
    ready: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
    processing: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    rejected: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight">Content Library</h2>
          <p className="text-[#9da6b9] mt-1">All uploaded media across the billboard network</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9da6b9]" />
            <input
              type="text"
              placeholder="Search content..."
              className="bg-[#1c222d] border border-[#282e39] rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-[#135bec]/50 focus:outline-none w-64"
            />
          </div>
          <div className="flex bg-[#1c222d] rounded-lg p-1">
            {(['all', 'ready', 'processing', 'rejected'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filter === f ? 'bg-[#135bec] text-white' : 'text-[#9da6b9] hover:text-white'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex bg-[#1c222d] rounded-lg p-1">
          <button onClick={() => setView('grid')} className={`p-2 rounded-md ${view === 'grid' ? 'bg-[#135bec]' : ''}`}>
            <Grid className="h-4 w-4" />
          </button>
          <button onClick={() => setView('list')} className={`p-2 rounded-md ${view === 'list' ? 'bg-[#135bec]' : ''}`}>
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content Grid */}
      <div className={view === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6' : 'space-y-4'}>
        {filtered.map((item: ContentItem) => {
          const config = statusConfig[item.status];
          const StatusIcon = config.icon;

          return (
            <div key={item.id} className="bg-[#1c222d] border border-[#282e39] rounded-xl overflow-hidden hover:border-[#135bec]/50 transition-colors">
              <div className="aspect-[9/16] bg-black relative flex items-center justify-center">
                {item.type === 'video' ? <Play className="h-12 w-12 text-white/30" /> : <Image className="h-12 w-12 text-white/30" />}
                {item.durationSeconds && (
                  <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                    {item.durationSeconds}s
                  </span>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-sm truncate">{item.advertiser}</p>
                  <span className={`flex items-center gap-1 text-xs font-bold ${config.color}`}>
                    <StatusIcon className="h-3 w-3" />
                    {item.status}
                  </span>
                </div>
                <p className="text-xs text-[#9da6b9]">{item.createdAt}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
