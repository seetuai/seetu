'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Monitor,
  Shield,
  Package,
  ListOrdered,
  FolderOpen,
  DollarSign,
  Users,
  Bell,
  Settings,
  Search,
  ChevronDown,
} from 'lucide-react';

const navItems = [
  { href: '/admin/billboards/operations', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/billboards/operations/live', label: 'Live Monitor', icon: Monitor },
  { href: '/admin/billboards/operations/moderation', label: 'Moderation', icon: Shield },
  { href: '/admin/billboards/operations/inventory', label: 'Inventory', icon: Package },
  { href: '/admin/billboards/operations/queue', label: 'Queue Control', icon: ListOrdered },
  { href: '/admin/billboards/operations/content', label: 'Content Library', icon: FolderOpen },
  { href: '/admin/billboards/operations/revenue', label: 'Revenue', icon: DollarSign },
  { href: '/admin/billboards/operations/advertisers', label: 'Advertisers', icon: Users },
  { href: '/admin/billboards/operations/alerts', label: 'Alerts', icon: Bell },
  { href: '/admin/billboards/operations/settings', label: 'Settings', icon: Settings },
];

export default function OperationsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-[#101622] text-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#282e39] flex flex-col">
        <div className="p-6 border-b border-[#282e39]">
          <h1 className="text-xl font-black tracking-tight">Seetu Ops</h1>
          <p className="text-xs text-[#9da6b9] mt-1">Billboard Network Manager</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/admin/billboards/operations' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#135bec] text-white'
                    : 'text-[#9da6b9] hover:bg-[#1c222d] hover:text-white'
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-[#282e39]">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#1c222d]">
            <div className="size-8 rounded-full bg-[#135bec] flex items-center justify-center text-xs font-bold">AD</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Admin</p>
              <p className="text-xs text-[#9da6b9]">Super Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-10 bg-[#101622] border-b border-[#282e39] px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9da6b9]" />
              <input
                type="text"
                placeholder="Search billboards, content, advertisers..."
                className="w-full bg-[#1c222d] border border-[#282e39] rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-[#135bec]/50 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-4">
              <button className="relative p-2 rounded-lg hover:bg-[#1c222d] transition-colors">
                <Bell className="h-5 w-5 text-[#9da6b9]" />
                <span className="absolute top-1 right-1 size-2 bg-red-500 rounded-full" />
              </button>
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
