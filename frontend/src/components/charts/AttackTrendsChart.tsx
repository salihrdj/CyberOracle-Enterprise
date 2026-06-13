'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TT } from '@/lib/utils';

interface AttackTrendsChartProps {
  data: { year: number; attack_count: number }[];
  className?: string;
}

export function AttackTrendsChart({ data, className = '' }: AttackTrendsChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ ...TT, padding: '12px 16px' }}>
        <p className="text-xs text-txt-dim mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-sm font-semibold" style={{ color: p.color || '#e2e8f0' }}>
            {p.name}: {p.value?.toLocaleString()}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className={`h-[300px] ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="year"
            stroke="#475569"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={{ stroke: '#1e293b' }}
            tickLine={{ stroke: '#1e293b' }}
          />
          <YAxis
            stroke="#475569"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={{ stroke: '#1e293b' }}
            tickLine={{ stroke: '#1e293b' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="attack_count"
            stroke="#a78bfa"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#050510', stroke: '#a78bfa', strokeWidth: 2 }}
            activeDot={{ r: 5, fill: '#a78bfa' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}