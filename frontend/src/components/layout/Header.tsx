'use client';

import { Bell, Radio, ChevronDown } from 'lucide-react';
import { useSession } from '@auth0/nextjs-auth0';

interface HeaderProps {
  children?: React.ReactNode;
  filter?: string;
  onFilterChange?: (value: string) => void;
}

export function Header({ children, filter, onFilterChange }: HeaderProps) {
  const { user, isLoading } = useSession();

  return (
    <header className="sticky top-0 z-30 px-8 py-4 flex items-center justify-between border-b border-border/30 glass-strong bg-bg/80 backdrop-blur-xl">
      <div>
        <h1 className="text-xl font-semibold text-white">
          {children || 'Dashboard'}
        </h1>
        <p className="text-xs text-txt-faint mt-0.5">Enterprise SOAR & Threat Intelligence</p>
      </div>
      <div className="flex items-center gap-3">
        {filter && onFilterChange && (
          <select
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="glass-input rounded-xl px-3 py-1.5 text-xs text-txt-dim bg-bg/60 border-border/30"
          >
            <option value="All">All Regions</option>
            <option value="India">India</option>
            <option value="Global">Global</option>
          </select>
        )}
        
        <div className="relative">
          <button className="p-2 bg-white/5 border border-border/30 hover:bg-white/10 rounded-xl text-txt-dim transition flex items-center gap-1.5">
            <Bell className="w-4 h-4" />
          </button>
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent-rose rounded-full" />
        </div>

        <div className="p-2 bg-white/5 border border-border/30 rounded-xl text-txt-dim flex items-center gap-1.5 text-[10px] font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-mint animate-pulse" />
          LIVE FEED
        </div>

        <div className="ml-4 pl-4 border-l border-border/30 flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden sm:block text-right">
                <p className="text-xs font-medium text-white">{user.name || user.email}</p>
                <p className="text-[10px] text-txt-faint">{user.email}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-lavender/40 to-accent-sky/40 flex items-center justify-center text-white font-medium text-sm">
                {(user.name || user.email || 'U')[0].toUpperCase()}
              </div>
            </>
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
              <Radio className="w-4 h-4 text-txt-dim" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}