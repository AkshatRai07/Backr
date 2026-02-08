import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    const variants = {
      default: 'bg-slate-700/50 text-slate-300 border-slate-600/50',
      success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
      danger: 'bg-red-500/10 text-red-400 border-red-500/30',
      info: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-sm',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center font-medium rounded-lg border backdrop-blur-sm',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
