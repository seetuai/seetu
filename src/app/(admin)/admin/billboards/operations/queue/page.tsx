'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { ListOrdered, Play, Pause, SkipForward, Trash2, GripVertical, Tv, RefreshCw, Plus, AlertCircle, WifiOff } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function QueueControlPage() {
  const [selectedBillboard, setSelectedBillboard] = useState<string | null>(null);
  const { data: billboards } = useSWR('/api/v1/admin/billboards/queues', fetcher, { refreshInterval: 5000 });

  const mockBillboards = [
    {
      id: '1', name: 'Plateau Centre', slug: 'plateau-centre', status: 'online', address: "Place de l'Indépendance",
      currentlyPlaying: { id: 'q1', content: { id: 'c1', title: 'Orange 5G Launch', advertiser: 'Orange Senegal', durationSeconds: 15 }, startedAt: new Date().toISOString() },
      queue: [
        { id: 'q2', position: 1, content: { title: 'Nike Air Max', advertiser: 'Nike', durationSeconds: 15 }, scheduledFor: '14:32:15' },
        { id: 'q3', position: 2, content: { title: 'ASPT Tourism', advertiser: 'ASPT', durationSeconds: 30 }, scheduledFor: '14:32:30' },
      ],
    },
    { id: '2', name: 'Almadies', slug: 'almadies', status: 'online', address: 'Route de Ngor', currentlyPlaying: null, queue: [] },
    { id: '3', name: 'Médina', slug: 'medina', status: 'offline', address: 'Avenue Blaise Diagne', currentlyPlaying: null, queue: [] },
  ];

  const displayBillboards = billboards?.billboards || mockBillboards;
  const currentBillboard = displayBillboards.find((b: any) => b.id === selectedBillboard) || displayBillboards[0];

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Billboard Sidebar */}
      <aside className="w-64 border-r border-[#282e39] flex flex-col bg-[#101622]">
        <div className="p-4 border-b border-[#282e39]">
          <h3 className="font-bold flex items-center gap-2">
            <Tv className="h-5 w-5 text-[#135bec]" /> Select Billboard
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          {displayBillboards.map((billboard: any) => (
            <div
              key={billboard.id}
              onClick={() => setSelectedBillboard(billboard.id)}
              className={`p-4 border-b border-[#282e39] cursor-pointer transition-colors ${
                currentBillboard?.id === billboard.id ? 'bg-[#135bec]/10 border-l-2 border-l-[#135bec]' : 'hover:bg-[#1c222d]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`size-2 rounded-full ${billboard.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="font-bold text-sm">{billboard.name}</span>
              </div>
              <p className="text-xs text-[#9da6b9]">{billboard.address}</p>
              <p className="text-xs text-[#9da6b9] mt-1">{billboard.queue?.length || 0} in queue</p>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-[#282e39]">
          <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors">
            <AlertCircle className="h-5 w-5" /> Emergency Stop
          </button>
        </div>
      </aside>

      {/* Main Queue Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#101622]">
        <div className="p-6 border-b border-[#282e39]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight">Queue Control</h2>
              <p className="text-[#9da6b9] mt-1">Manage real-time rotation for {currentBillboard?.name}</p>
            </div>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 bg-[#282e39] rounded-lg text-sm font-medium hover:bg-[#3b4453] transition-colors">
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-[#135bec] text-white rounded-lg text-sm font-bold hover:bg-[#135bec]/90 transition-colors">
                <Plus className="h-4 w-4" /> Add Media
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {currentBillboard?.status === 'offline' ? (
            <div className="flex flex-col items-center justify-center h-full">
              <WifiOff className="h-16 w-16 text-red-500/50 mb-4" />
              <h3 className="text-xl font-bold mb-2">Billboard Offline</h3>
              <p className="text-[#9da6b9]">This billboard is currently disconnected</p>
            </div>
          ) : (
            <>
              {currentBillboard?.currentlyPlaying && (
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                    <span className="size-2 bg-[#135bec] rounded-full animate-pulse" /> Currently Playing
                  </h3>
                  <div className="bg-[#1c222d] border-2 border-[#135bec] rounded-xl p-5 shadow-lg shadow-[#135bec]/10">
                    <div className="flex gap-6">
                      <div className="w-48 h-32 bg-black rounded-lg flex items-center justify-center">
                        <Play className="h-8 w-8 text-white/50" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-xl font-bold">{currentBillboard.currentlyPlaying.content.title}</h4>
                        <p className="text-[#9da6b9] text-sm">{currentBillboard.currentlyPlaying.content.advertiser}</p>
                        <div className="w-full bg-[#282e39] h-2 rounded-full mt-4 overflow-hidden">
                          <div className="h-full w-[65%] bg-[#135bec] rounded-full" />
                        </div>
                        <div className="flex gap-4 mt-4">
                          <button className="text-xs font-bold text-[#9da6b9] hover:text-white flex items-center gap-1">
                            <Pause className="h-4 w-4" /> Pause
                          </button>
                          <button className="text-xs font-bold text-[#9da6b9] hover:text-white flex items-center gap-1">
                            <SkipForward className="h-4 w-4" /> Skip
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-bold text-[#9da6b9] uppercase tracking-wider mb-4">
                  Up Next ({currentBillboard?.queue?.length || 0} Items)
                </h3>
                <div className="space-y-3">
                  {currentBillboard?.queue?.map((item: any, index: number) => (
                    <div key={item.id} className="flex items-center gap-4 bg-[#1c222d] border border-[#282e39] p-3 rounded-lg hover:border-[#3b4453] transition-all">
                      <GripVertical className="h-5 w-5 text-[#9da6b9] cursor-grab" />
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#282e39] text-xs font-bold text-[#9da6b9]">
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <div className="w-16 h-10 bg-black rounded flex items-center justify-center">
                        <Play className="h-4 w-4 text-white/50" />
                      </div>
                      <div className="flex-1">
                        <h5 className="text-sm font-bold">{item.content.title}</h5>
                        <p className="text-[#9da6b9] text-xs">{item.content.durationSeconds}s • Starts {item.scheduledFor}</p>
                      </div>
                      <button className="text-[#9da6b9] hover:text-white transition-colors p-2">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Proof of Play Sidebar */}
      <aside className="w-80 border-l border-[#282e39] flex flex-col bg-[#101622] p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wider">Proof of Play</h3>
          <span className="text-[10px] bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded-full font-bold">LIVE</span>
        </div>
        <div className="w-full aspect-video bg-black rounded-lg border border-[#3b4453] mb-6 flex items-center justify-center">
          <Tv className="h-8 w-8 text-[#282e39]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="aspect-video bg-black rounded border border-[#282e39]" />
              <span className="text-[9px] text-[#9da6b9] font-mono">14:{25 - i * 5}:00</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
