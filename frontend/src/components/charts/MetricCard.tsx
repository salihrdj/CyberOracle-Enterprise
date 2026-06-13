'use client';

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: number;
  color: string;
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({ label, value, delta, color, icon, className = '' }: MetricCardProps) {
  return (
    <div className={`glass p-5 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-txt-faint font-mono uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {delta !== undefined && (
            <p className={`text-xs font-semibold mt-1 ${delta >= 0 ? 'text-accent-mint' : 'text-accent-rose'}`}>
              {delta >= 0 ? '+' : ''}{delta.toFixed(1)}% vs last period
            </p>
          )}
        </div>
        {icon && (
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
            <span style={{ color }}>{icon}</span>
          </div>
        )}
      </div>
      <div className="metric-glow w-16 mt-4" style={{ '--glow-color': color } as React.CSSProperties} />
    </div>
  );
}