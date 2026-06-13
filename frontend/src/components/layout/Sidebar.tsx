'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Radio,
  LayoutDashboard,
  Briefcase,
  Activity,
  MessageSquare,
  Zap,
  Globe,
  Search,
  Database,
  Shield,
  HelpCircle,
  LogOut,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard/siem', label: 'SIEM Live Monitor', icon: Radio },
  { href: '/dashboard/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/clients', label: 'Clients Scan', icon: Briefcase },
  { href: '/dashboard/system', label: 'System Health', icon: Activity },
  { href: '/dashboard/ai', label: 'AI Analyst', icon: MessageSquare },
  { href: '/dashboard/forecast', label: 'Forecasting', icon: Zap },
  { href: '/dashboard/network', label: 'Analytics Maps', icon: Globe },
  { href: '/dashboard/scanner', label: 'Quick Scan', icon: Search },
  { href: '/dashboard/intelligence', label: 'Threat Intel DB', icon: Database },
] as const;

export function Sidebar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-full w-64 glass-strong border-r border-border/30 flex flex-col py-6 px-4 shrink-0">
      <div className="flex items-center gap-2.5 px-3 mb-8">
        <div className="w-8 h-8 rounded-xl bg-accent-sky/20 flex items-center justify-center border border-accent-sky/30">
          <Shield className="w-4 h-4 text-accent-sky" />
        </div>
        <div>
          <span className="font-semibold text-sm tracking-wide text-txt block">CyberOracle</span>
          <span className="text-[7.5px] text-accent-sky font-mono font-bold uppercase tracking-wider">ENTERPRISE</span>
        </div>
      </div>

      <p className="text-[9px] font-bold text-txt-faint tracking-[0.2em] uppercase mb-3 px-3">Command Center</p>
      
      <nav className="space-y-0.5 flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-200 ${
                isActive
                  ? 'bg-white/8 text-white font-medium shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] border-l-2 border-accent-sky'
                  : 'text-txt-dim hover:text-txt hover:bg-white/4'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/30 pt-4 space-y-2">
        <div className="bg-white/5 p-3 rounded-xl border border-border/30 flex flex-col gap-1 text-[11px] font-mono text-txt-dim">
          <div className="flex justify-between text-[9px] text-txt-faint uppercase font-bold">
            <span>Security Clearance</span>
            <span className="text-accent-sky">LVL 3</span>
          </div>
          <div className="truncate font-semibold">SOC Lead Analyst</div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 text-[12px] text-accent-rose bg-accent-rose/10 hover:bg-accent-rose/25 rounded-xl transition cursor-pointer font-semibold uppercase tracking-wider font-mono justify-center"
        >
          <LogOut className="w-3.5 h-3.5" />
          Log Out
        </button>
      </div>
    </aside>
  );
}