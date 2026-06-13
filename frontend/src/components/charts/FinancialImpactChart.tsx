'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TT } from '@/lib/utils';

interface FinancialImpactChartProps {
  data: { year: number; financial_loss_in_million_: number }[];
  className?: string;
}

export function FinancialImpactChart({ data, className = '' }: FinancialImpactChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ ...TT, padding: '12px 16px' }}>
        <p className="text-xs text-txt-dim mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-sm font-semibold" style={{ color: p.color || '#e2e8f0' }}>
            {p.name}: ${p.value?.toLocaleString()}M
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className={`h-[220px] ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="20%">
          <defs>
            <linearGradient id="barSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.15} />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="year"
            stroke="#475569"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke="#475569"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(56,189,248,0.06)', radius: 8 }} />
          <Bar
            dataKey="financial_loss_in_million_"
            fill="url(#barSky)"
            radius={[8, 8, 0, 0]}
            name="Loss ($M)"
            filter="url(#glow)"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}