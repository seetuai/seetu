'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Settings,
  Shield,
  DollarSign,
  Users,
  Server,
  Database,
  Cloud,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
  Key,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Clock,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'moderator' | 'viewer';
  lastActive: string;
  status: 'active' | 'suspended';
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<'moderation' | 'pricing' | 'users' | 'system'>('moderation');
  const [showApiKey, setShowApiKey] = useState(false);

  // Moderation thresholds
  const [moderationSettings, setModerationSettings] = useState({
    autoApproveThreshold: 85,
    autoRejectThreshold: 30,
    nudityThreshold: 15,
    violenceThreshold: 20,
    politicalThreshold: 25,
    aiEnabled: true,
  });

  // Pricing settings
  const [pricingSettings, setPricingSettings] = useState({
    basePricePerSlot: 5000,
    premiumMultiplier: 1.5,
    rushMultiplier: 2.0,
    weekendMultiplier: 1.25,
    bulkDiscount5: 10,
    bulkDiscount10: 20,
  });

  // Mock admin users
  const adminUsers: AdminUser[] = [
    { id: '1', name: 'Amadou Diallo', email: 'amadou@seetu.sn', role: 'super_admin', lastActive: '2 mins ago', status: 'active' },
    { id: '2', name: 'Fatou Sow', email: 'fatou@seetu.sn', role: 'admin', lastActive: '1 hour ago', status: 'active' },
    { id: '3', name: 'Moussa Ndiaye', email: 'moussa@seetu.sn', role: 'moderator', lastActive: '3 hours ago', status: 'active' },
    { id: '4', name: 'Aissatou Ba', email: 'aissatou@seetu.sn', role: 'viewer', lastActive: '2 days ago', status: 'suspended' },
  ];

  const systemHealth = {
    api: { status: 'healthy', latency: 42, uptime: 99.98 },
    database: { status: 'healthy', connections: 23, maxConnections: 100 },
    cdn: { status: 'healthy', bandwidth: '2.4 TB', cacheHitRate: 94.2 },
    redis: { status: 'healthy', memory: '256 MB', keys: 12450 },
  };

  const roleStyles = {
    super_admin: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    admin: 'bg-[#135bec]/10 text-[#135bec] border-[#135bec]/20',
    moderator: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    viewer: 'bg-[#9da6b9]/10 text-[#9da6b9] border-[#9da6b9]/20',
  };

  const renderSlider = (
    label: string,
    value: number,
    onChange: (val: number) => void,
    description: string,
    color: string = '#135bec'
  ) => (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm font-bold">{label}</p>
          <p className="text-xs text-[#9da6b9]">{description}</p>
        </div>
        <span className="text-lg font-mono font-bold" style={{ color }}>{value}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${value}%, #282e39 ${value}%, #282e39 100%)`,
        }}
      />
    </div>
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Settings Sidebar */}
      <aside className="w-64 border-r border-[#282e39] flex flex-col bg-[#101622]">
        <div className="p-4 border-b border-[#282e39]">
          <h3 className="font-bold flex items-center gap-2">
            <Settings className="h-5 w-5 text-[#135bec]" />
            Settings
          </h3>
        </div>
        <nav className="flex-1 p-2">
          {[
            { id: 'moderation', label: 'Moderation', icon: Shield, description: 'AI thresholds & rules' },
            { id: 'pricing', label: 'Pricing', icon: DollarSign, description: 'Rates & discounts' },
            { id: 'users', label: 'Access Control', icon: Users, description: 'Admin permissions' },
            { id: 'system', label: 'System Health', icon: Server, description: 'Infrastructure status' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as any)}
              className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors mb-1 ${
                activeSection === item.id
                  ? 'bg-[#135bec]/10 border border-[#135bec]/30'
                  : 'hover:bg-[#1c222d]'
              }`}
            >
              <item.icon className={`h-5 w-5 mt-0.5 ${activeSection === item.id ? 'text-[#135bec]' : 'text-[#9da6b9]'}`} />
              <div>
                <p className={`text-sm font-bold ${activeSection === item.id ? 'text-white' : 'text-[#9da6b9]'}`}>
                  {item.label}
                </p>
                <p className="text-[10px] text-[#9da6b9]">{item.description}</p>
              </div>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-[#282e39]">
          <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#135bec] hover:bg-[#135bec]/90 text-white rounded-lg font-bold transition-colors">
            <Save className="h-4 w-4" />
            Save All Changes
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 bg-[#101622]">
        {activeSection === 'moderation' && (
          <div className="max-w-3xl space-y-8">
            <div>
              <h2 className="text-2xl font-black tracking-tight">Moderation Settings</h2>
              <p className="text-[#9da6b9] mt-1">
                Configure AI-powered content moderation thresholds and rules
              </p>
            </div>

            {/* AI Toggle */}
            <div className="bg-[#1c222d] border border-[#282e39] rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-lg bg-[#135bec]/10 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-[#135bec]" />
                  </div>
                  <div>
                    <p className="font-bold">AI-Assisted Moderation</p>
                    <p className="text-sm text-[#9da6b9]">Use Gemini 3 Flash to analyze content automatically</p>
                  </div>
                </div>
                <button
                  onClick={() => setModerationSettings(prev => ({ ...prev, aiEnabled: !prev.aiEnabled }))}
                  className={`w-14 h-8 rounded-full relative transition-colors ${
                    moderationSettings.aiEnabled ? 'bg-[#135bec]' : 'bg-[#282e39]'
                  }`}
                >
                  <div className={`absolute top-1 size-6 bg-white rounded-full transition-transform ${
                    moderationSettings.aiEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>

            {/* Auto-moderation Thresholds */}
            <div className="bg-[#1c222d] border border-[#282e39] rounded-xl p-6 space-y-6">
              <h3 className="font-bold text-lg">Auto-Moderation Thresholds</h3>

              {renderSlider(
                'Auto-Approve Threshold',
                moderationSettings.autoApproveThreshold,
                (val) => setModerationSettings(prev => ({ ...prev, autoApproveThreshold: val })),
                'Content with safety score above this will be auto-approved',
                '#22c55e'
              )}

              {renderSlider(
                'Auto-Reject Threshold',
                moderationSettings.autoRejectThreshold,
                (val) => setModerationSettings(prev => ({ ...prev, autoRejectThreshold: val })),
                'Content with safety score below this will be auto-rejected',
                '#ef4444'
              )}

              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <p className="text-xs text-amber-400">
                  <strong>Note:</strong> Content scoring between {moderationSettings.autoRejectThreshold}% and {moderationSettings.autoApproveThreshold}% will require manual review.
                </p>
              </div>
            </div>

            {/* Category Thresholds */}
            <div className="bg-[#1c222d] border border-[#282e39] rounded-xl p-6 space-y-6">
              <h3 className="font-bold text-lg">Category Sensitivity</h3>
              <p className="text-sm text-[#9da6b9] -mt-4">Maximum allowed percentage for each category before flagging</p>

              {renderSlider(
                'Nudity / Adult Content',
                moderationSettings.nudityThreshold,
                (val) => setModerationSettings(prev => ({ ...prev, nudityThreshold: val })),
                'Skin exposure, suggestive imagery',
                '#ef4444'
              )}

              {renderSlider(
                'Violence / Graphic Content',
                moderationSettings.violenceThreshold,
                (val) => setModerationSettings(prev => ({ ...prev, violenceThreshold: val })),
                'Weapons, injuries, aggressive content',
                '#f97316'
              )}

              {renderSlider(
                'Political / Controversial',
                moderationSettings.politicalThreshold,
                (val) => setModerationSettings(prev => ({ ...prev, politicalThreshold: val })),
                'Political figures, parties, divisive topics',
                '#a855f7'
              )}
            </div>
          </div>
        )}

        {activeSection === 'pricing' && (
          <div className="max-w-3xl space-y-8">
            <div>
              <h2 className="text-2xl font-black tracking-tight">Pricing Configuration</h2>
              <p className="text-[#9da6b9] mt-1">
                Set base rates and multipliers for billboard slots (FCFA)
              </p>
            </div>

            {/* Base Pricing */}
            <div className="bg-[#1c222d] border border-[#282e39] rounded-xl p-6 space-y-6">
              <h3 className="font-bold text-lg">Base Rates</h3>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold mb-2">Base Price per Slot (FCFA)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={pricingSettings.basePricePerSlot}
                      onChange={(e) => setPricingSettings(prev => ({ ...prev, basePricePerSlot: Number(e.target.value) }))}
                      className="w-full bg-[#101622] border border-[#282e39] rounded-lg py-3 px-4 text-lg font-mono focus:ring-2 focus:ring-[#135bec]/50 focus:outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9da6b9] text-sm">FCFA</span>
                  </div>
                  <p className="text-xs text-[#9da6b9] mt-1">Standard 5-minute slot rate</p>
                </div>
              </div>
            </div>

            {/* Multipliers */}
            <div className="bg-[#1c222d] border border-[#282e39] rounded-xl p-6 space-y-6">
              <h3 className="font-bold text-lg">Rate Multipliers</h3>

              <div className="grid grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-bold mb-2">Premium Locations</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={pricingSettings.premiumMultiplier}
                      onChange={(e) => setPricingSettings(prev => ({ ...prev, premiumMultiplier: Number(e.target.value) }))}
                      className="w-full bg-[#101622] border border-[#282e39] rounded-lg py-3 px-4 font-mono focus:ring-2 focus:ring-[#135bec]/50 focus:outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9da6b9] text-sm">x</span>
                  </div>
                  <p className="text-xs text-[#9da6b9] mt-1">Plateau, Almadies</p>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Rush Hour</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={pricingSettings.rushMultiplier}
                      onChange={(e) => setPricingSettings(prev => ({ ...prev, rushMultiplier: Number(e.target.value) }))}
                      className="w-full bg-[#101622] border border-[#282e39] rounded-lg py-3 px-4 font-mono focus:ring-2 focus:ring-[#135bec]/50 focus:outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9da6b9] text-sm">x</span>
                  </div>
                  <p className="text-xs text-[#9da6b9] mt-1">7-9 AM, 5-8 PM</p>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Weekend</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={pricingSettings.weekendMultiplier}
                      onChange={(e) => setPricingSettings(prev => ({ ...prev, weekendMultiplier: Number(e.target.value) }))}
                      className="w-full bg-[#101622] border border-[#282e39] rounded-lg py-3 px-4 font-mono focus:ring-2 focus:ring-[#135bec]/50 focus:outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9da6b9] text-sm">x</span>
                  </div>
                  <p className="text-xs text-[#9da6b9] mt-1">Saturday & Sunday</p>
                </div>
              </div>
            </div>

            {/* Bulk Discounts */}
            <div className="bg-[#1c222d] border border-[#282e39] rounded-xl p-6 space-y-6">
              <h3 className="font-bold text-lg">Bulk Discounts</h3>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold mb-2">5+ Billboards</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={pricingSettings.bulkDiscount5}
                      onChange={(e) => setPricingSettings(prev => ({ ...prev, bulkDiscount5: Number(e.target.value) }))}
                      className="w-full bg-[#101622] border border-[#282e39] rounded-lg py-3 px-4 font-mono focus:ring-2 focus:ring-[#135bec]/50 focus:outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9da6b9] text-sm">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">10+ Billboards</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={pricingSettings.bulkDiscount10}
                      onChange={(e) => setPricingSettings(prev => ({ ...prev, bulkDiscount10: Number(e.target.value) }))}
                      className="w-full bg-[#101622] border border-[#282e39] rounded-lg py-3 px-4 font-mono focus:ring-2 focus:ring-[#135bec]/50 focus:outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9da6b9] text-sm">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Price Preview */}
            <div className="bg-[#135bec]/5 border border-[#135bec]/20 rounded-xl p-6">
              <h3 className="font-bold text-[#135bec] mb-4">Price Preview Calculator</h3>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="bg-[#1c222d] p-4 rounded-lg">
                  <p className="text-[#9da6b9] text-xs mb-1">Standard Slot</p>
                  <p className="font-mono font-bold">{pricingSettings.basePricePerSlot.toLocaleString()} FCFA</p>
                </div>
                <div className="bg-[#1c222d] p-4 rounded-lg">
                  <p className="text-[#9da6b9] text-xs mb-1">Premium Location</p>
                  <p className="font-mono font-bold">{(pricingSettings.basePricePerSlot * pricingSettings.premiumMultiplier).toLocaleString()} FCFA</p>
                </div>
                <div className="bg-[#1c222d] p-4 rounded-lg">
                  <p className="text-[#9da6b9] text-xs mb-1">Rush Hour</p>
                  <p className="font-mono font-bold">{(pricingSettings.basePricePerSlot * pricingSettings.rushMultiplier).toLocaleString()} FCFA</p>
                </div>
                <div className="bg-[#1c222d] p-4 rounded-lg">
                  <p className="text-[#9da6b9] text-xs mb-1">Premium + Rush</p>
                  <p className="font-mono font-bold">{(pricingSettings.basePricePerSlot * pricingSettings.premiumMultiplier * pricingSettings.rushMultiplier).toLocaleString()} FCFA</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'users' && (
          <div className="max-w-4xl space-y-8">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Access Control</h2>
                <p className="text-[#9da6b9] mt-1">
                  Manage administrator accounts and permissions
                </p>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-[#135bec] text-white rounded-lg font-bold hover:bg-[#135bec]/90 transition-colors">
                <Plus className="h-4 w-4" />
                Add Admin
              </button>
            </div>

            {/* Role Legend */}
            <div className="flex gap-4 flex-wrap">
              {[
                { role: 'super_admin', label: 'Super Admin', desc: 'Full system access' },
                { role: 'admin', label: 'Admin', desc: 'Manage content & users' },
                { role: 'moderator', label: 'Moderator', desc: 'Review content only' },
                { role: 'viewer', label: 'Viewer', desc: 'Read-only access' },
              ].map((item) => (
                <div key={item.role} className="flex items-center gap-2 text-xs">
                  <span className={`px-2 py-1 rounded border ${roleStyles[item.role as keyof typeof roleStyles]}`}>
                    {item.label}
                  </span>
                  <span className="text-[#9da6b9]">{item.desc}</span>
                </div>
              ))}
            </div>

            {/* Users Table */}
            <div className="bg-[#1c222d] border border-[#282e39] rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#101622] text-[#9da6b9] uppercase text-xs font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Last Active</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#282e39]">
                  {adminUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-[#282e39]/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-full bg-[#135bec]/20 flex items-center justify-center text-[#135bec] font-bold">
                            {user.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-bold">{user.name}</p>
                            <p className="text-xs text-[#9da6b9]">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold border ${roleStyles[user.role]}`}>
                          {user.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {user.status === 'active' ? (
                          <span className="flex items-center gap-1.5 text-green-500 text-xs font-bold">
                            <span className="size-2 bg-green-500 rounded-full" />
                            Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-red-500 text-xs font-bold">
                            <span className="size-2 bg-red-500 rounded-full" />
                            Suspended
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-[#9da6b9]">{user.lastActive}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-2 hover:bg-[#282e39] rounded-lg transition-colors">
                            <Edit className="h-4 w-4 text-[#9da6b9]" />
                          </button>
                          <button className="p-2 hover:bg-[#282e39] rounded-lg transition-colors">
                            <Key className="h-4 w-4 text-[#9da6b9]" />
                          </button>
                          <button className="p-2 hover:bg-red-500/10 rounded-lg transition-colors">
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* API Keys */}
            <div className="bg-[#1c222d] border border-[#282e39] rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-lg">API Keys</h3>
                  <p className="text-sm text-[#9da6b9]">Manage programmatic access to the billboard API</p>
                </div>
                <button className="flex items-center gap-2 px-3 py-1.5 bg-[#282e39] rounded-lg text-sm font-medium hover:bg-[#3b4453] transition-colors">
                  <Plus className="h-4 w-4" />
                  Generate Key
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-[#101622] rounded-lg">
                  <div className="flex items-center gap-4">
                    <Key className="h-5 w-5 text-[#9da6b9]" />
                    <div>
                      <p className="text-sm font-bold">Production API Key</p>
                      <p className="text-xs text-[#9da6b9]">Created Jan 15, 2024</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <code className="px-3 py-1.5 bg-[#282e39] rounded text-xs font-mono">
                      {showApiKey ? 'bb_prod_xxxxxxxxxxxxxxxxxxxxxxxxxxxx' : '••••••••••••••••••••••••••••••'}
                    </code>
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="p-2 hover:bg-[#282e39] rounded transition-colors"
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4 text-[#9da6b9]" /> : <Eye className="h-4 w-4 text-[#9da6b9]" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'system' && (
          <div className="max-w-4xl space-y-8">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-black tracking-tight">System Health</h2>
                <p className="text-[#9da6b9] mt-1">
                  Infrastructure monitoring and status
                </p>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-[#282e39] rounded-lg text-sm font-medium hover:bg-[#3b4453] transition-colors">
                <RefreshCw className="h-4 w-4" />
                Refresh Status
              </button>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-2 gap-6">
              {/* API Status */}
              <div className="bg-[#1c222d] border border-[#282e39] rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Server className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <p className="font-bold">API Server</p>
                      <p className="text-xs text-green-500 font-bold">Operational</p>
                    </div>
                  </div>
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#9da6b9]">Response Time</span>
                    <span className="font-mono">{systemHealth.api.latency}ms</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#9da6b9]">Uptime (30d)</span>
                    <span className="font-mono text-green-500">{systemHealth.api.uptime}%</span>
                  </div>
                </div>
              </div>

              {/* Database Status */}
              <div className="bg-[#1c222d] border border-[#282e39] rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Database className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <p className="font-bold">Database</p>
                      <p className="text-xs text-green-500 font-bold">Healthy</p>
                    </div>
                  </div>
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#9da6b9]">Active Connections</span>
                    <span className="font-mono">{systemHealth.database.connections}/{systemHealth.database.maxConnections}</span>
                  </div>
                  <div className="w-full bg-[#282e39] h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${(systemHealth.database.connections / systemHealth.database.maxConnections) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* CDN Status */}
              <div className="bg-[#1c222d] border border-[#282e39] rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Cloud className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <p className="font-bold">CDN / Storage</p>
                      <p className="text-xs text-green-500 font-bold">Operational</p>
                    </div>
                  </div>
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#9da6b9]">Bandwidth (30d)</span>
                    <span className="font-mono">{systemHealth.cdn.bandwidth}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#9da6b9]">Cache Hit Rate</span>
                    <span className="font-mono text-green-500">{systemHealth.cdn.cacheHitRate}%</span>
                  </div>
                </div>
              </div>

              {/* Redis Status */}
              <div className="bg-[#1c222d] border border-[#282e39] rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Clock className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <p className="font-bold">Redis / Queue</p>
                      <p className="text-xs text-green-500 font-bold">Connected</p>
                    </div>
                  </div>
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#9da6b9]">Memory Usage</span>
                    <span className="font-mono">{systemHealth.redis.memory}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#9da6b9]">Total Keys</span>
                    <span className="font-mono">{systemHealth.redis.keys.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Incidents */}
            <div className="bg-[#1c222d] border border-[#282e39] rounded-xl p-6">
              <h3 className="font-bold text-lg mb-4">Recent Incidents</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-[#101622] rounded-lg">
                  <div className="size-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm">Scheduled Maintenance Completed</p>
                      <span className="text-xs text-[#9da6b9]">Jan 15, 2024 02:00 GMT</span>
                    </div>
                    <p className="text-xs text-[#9da6b9] mt-1">Database optimization and index rebuild completed successfully. No downtime reported.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-[#101622] rounded-lg">
                  <div className="size-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm">Elevated API Latency</p>
                      <span className="text-xs text-[#9da6b9]">Jan 12, 2024 14:32 GMT</span>
                    </div>
                    <p className="text-xs text-[#9da6b9] mt-1">Brief spike in response times (avg 250ms) due to traffic surge. Auto-scaled within 5 minutes.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
