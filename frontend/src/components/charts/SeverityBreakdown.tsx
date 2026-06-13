'use client';

interface SeverityItem {
  label: string;
  percentage: number;
  color: string;
}

interface SeverityBreakdownProps {
  items?: SeverityItem[];
  className?: string;
}

const DEFAULT_ITEMS: SeverityItem[] = [
  { label: 'Critical', percentage: 15, color: '#fb7185' },
  { label: 'High', percentage: 55, color: '#fbbf24' },
  { label: 'Medium', percentage: 65, color: '#38bdf8' },
  { label: 'Low', percentage: 85, color: '#34d399' },
];

export function SeverityBreakdown({ items = DEFAULT_ITEMS, className = '' }: SeverityBreakdownProps) {
  return (
    <div className={`flex flex-wrap justify-center gap-6 py-6 ${className}`}>
      {items.map((item) => (
        <div key={item.label} className="flex flex-col items-center gap-2">
          <SeverityRing percentage={item.percentage} color={item.color} size={80} strokeWidth={6} />
          <span className="text-[11px] text-txt-dim">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

interface SeverityRingProps {
  percentage: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}

function SeverityRing({ percentage, color, size = 80, strokeWidth = 6 }: SeverityRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percentage / 100);

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{
          filter: `drop-shadow(0 0 8px ${color})`,
          transition: 'stroke-dashoffset 0.5s ease-out',
        }}
      />
    </svg>
  );
}