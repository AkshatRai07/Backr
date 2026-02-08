'use client';

import { Card, CardContent } from '@/components/ui';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'gradient' | 'glow';
  color?: 'cyan' | 'emerald' | 'violet' | 'orange' | 'pink';
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = 'default',
  color = 'cyan',
}: StatCardProps) {
  const colorClasses = {
    cyan: {
      gradient: 'from-cyan-500/20 to-blue-500/20',
      border: 'border-cyan-500/30',
      text: 'text-cyan-400',
      glow: 'shadow-cyan-500/20',
    },
    emerald: {
      gradient: 'from-emerald-500/20 to-teal-500/20',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      glow: 'shadow-emerald-500/20',
    },
    violet: {
      gradient: 'from-violet-500/20 to-purple-500/20',
      border: 'border-violet-500/30',
      text: 'text-violet-400',
      glow: 'shadow-violet-500/20',
    },
    orange: {
      gradient: 'from-orange-500/20 to-amber-500/20',
      border: 'border-orange-500/30',
      text: 'text-orange-400',
      glow: 'shadow-orange-500/20',
    },
    pink: {
      gradient: 'from-pink-500/20 to-rose-500/20',
      border: 'border-pink-500/30',
      text: 'text-pink-400',
      glow: 'shadow-pink-500/20',
    },
  };

  const colors = colorClasses[color];

  return (
    <Card
      variant={variant === 'gradient' ? 'gradient' : 'default'}
      hover
      className={`${
        variant === 'glow' ? `shadow-lg ${colors.glow}` : ''
      } ${variant === 'gradient' ? colors.border : ''}`}
    >
      <CardContent className={`p-5 ${
        variant === 'gradient' ? `bg-linear-to-br ${colors.gradient}` : ''
      }`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm text-slate-400 font-medium">{title}</p>
          {icon && (
            <div className={`p-2 rounded-lg bg-slate-800/50 ${colors.text}`}>
              {icon}
            </div>
          )}
        </div>

        {/* Value */}
        <div className="mb-1">
          <p className="text-3xl font-bold text-white tracking-tight">
            {value}
          </p>
        </div>

        {/* Subtitle and trend */}
        <div className="flex items-center justify-between">
          {subtitle && (
            <p className="text-xs text-slate-500">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 text-xs ${
              trend.isPositive ? 'text-emerald-400' : 'text-red-400'
            }`}>
              <svg
                className={`w-3 h-3 ${trend.isPositive ? '' : 'rotate-180'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 10l7-7m0 0l7 7m-7-7v18"
                />
              </svg>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Mini stat for inline display
export function MiniStat({
  label,
  value,
  color = 'cyan',
}: {
  label: string;
  value: string | number;
  color?: 'cyan' | 'emerald' | 'violet' | 'orange' | 'pink';
}) {
  const colorClasses = {
    cyan: 'text-cyan-400',
    emerald: 'text-emerald-400',
    violet: 'text-violet-400',
    orange: 'text-orange-400',
    pink: 'text-pink-400',
  };

  return (
    <div className="flex flex-col">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-lg font-semibold ${colorClasses[color]}`}>{value}</span>
    </div>
  );
}

// Stats row for quick overview
export function StatsRow({
  stats,
}: {
  stats: Array<{
    label: string;
    value: string | number;
    color?: 'cyan' | 'emerald' | 'violet' | 'orange' | 'pink';
  }>;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
      {stats.map((stat, index) => (
        <div key={stat.label} className="flex items-center gap-4">
          <MiniStat
            label={stat.label}
            value={stat.value}
            color={stat.color || 'cyan'}
          />
          {index < stats.length - 1 && (
            <div className="h-8 w-px bg-slate-700/50" />
          )}
        </div>
      ))}
    </div>
  );
}
