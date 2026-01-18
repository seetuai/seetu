'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Shield, Play, CheckCircle, XCircle, AlertTriangle, Eye } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ModerationItem {
  id: string;
  thumbnailUrl: string;
  advertiser: string;
  submittedAt: string;
  riskLevel: 'low' | 'medium' | 'high';
  aiAnalysis: { nudity: number; violence: number; political: number; overall: number };
}

export default function ModerationPage() {
  const [selected, setSelected] = useState<string | null>(null);

  const { data } = useSWR('/api/v1/admin/billboards/content?status=pending_moderation', fetcher);

  const mockItems: ModerationItem[] = [
    { id: '1', thumbnailUrl: '', advertiser: 'Orange Senegal', submittedAt: '10 mins ago', riskLevel: 'low', aiAnalysis: { nudity: 0, violence: 2, political: 0, overall: 92 } },
    { id: '2', thumbnailUrl: '', advertiser: 'Local Business', submittedAt: '25 mins ago', riskLevel: 'medium', aiAnalysis: { nudity: 15, violence: 5, political: 0, overall: 68 } },
    { id: '3', thumbnailUrl: '', advertiser: 'Unknown', submittedAt: '1 hour ago', riskLevel: 'high', aiAnalysis: { nudity: 45, violence: 10, political: 5, overall: 35 } },
  ];

  const items = data?.content || mockItems;
  const selectedItem = items.find((i: ModerationItem) => i.id === selected) || items[0];

  const riskConfig = {
    low: { color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' },
    medium: { color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    high: { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Queue List */}
      <aside className="w-80 border-r border-[#282e39] flex flex-col bg-[#101622]">
        <div className="p-4 border-b border-[#282e39]">
          <h3 className="font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#135bec]" />
            Moderation Queue ({items.length})
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          {items.map((item: ModerationItem) => {
            const config = riskConfig[item.riskLevel];
            return (
              <div
                key={item.id}
                onClick={() => setSelected(item.id)}
                className={`p-4 border-b border-[#282e39] cursor-pointer transition-colors ${
                  selectedItem?.id === item.id ? 'bg-[#135bec]/10 border-l-2 border-l-[#135bec]' : 'hover:bg-[#1c222d]'
                }`}
              >
                <div className="flex gap-3">
                  <div className="size-16 bg-[#282e39] rounded shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.advertiser}</p>
                    <p className="text-xs text-[#9da6b9]">{item.submittedAt}</p>
                    <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded ${config.bg} ${config.color}`}>
                      {item.riskLevel.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Preview Panel */}
      <main className="flex-1 flex flex-col bg-[#101622]">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-2xl aspect-video bg-black rounded-xl flex items-center justify-center">
            <Play className="h-16 w-16 text-white/30" />
          </div>
        </div>
        <div className="p-6 border-t border-[#282e39] flex gap-4">
          <button className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors">
            <CheckCircle className="h-5 w-5" /> Approve
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors">
            <XCircle className="h-5 w-5" /> Reject
          </button>
        </div>
      </main>

      {/* AI Analysis Panel */}
      <aside className="w-80 border-l border-[#282e39] flex flex-col bg-[#101622] p-6">
        <h3 className="font-bold mb-6">AI Analysis</h3>
        {selectedItem && (
          <div className="space-y-4">
            <div className="p-4 bg-[#1c222d] rounded-lg">
              <p className="text-xs text-[#9da6b9] mb-2">Overall Safety Score</p>
              <p className="text-3xl font-black">{selectedItem.aiAnalysis.overall}%</p>
              <div className="w-full bg-[#282e39] h-2 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${selectedItem.aiAnalysis.overall > 70 ? 'bg-green-500' : selectedItem.aiAnalysis.overall > 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${selectedItem.aiAnalysis.overall}%` }}
                />
              </div>
            </div>
            {['nudity', 'violence', 'political'].map((key) => (
              <div key={key} className="flex justify-between items-center">
                <span className="text-sm text-[#9da6b9] capitalize">{key}</span>
                <span className={`font-mono text-sm ${(selectedItem.aiAnalysis as any)[key] > 20 ? 'text-red-500' : 'text-green-500'}`}>
                  {(selectedItem.aiAnalysis as any)[key]}%
                </span>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
