import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    const baseStyles = `
      relative inline-flex items-center justify-center font-medium
      transition-all duration-300 ease-out
      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900
      disabled:opacity-50 disabled:cursor-not-allowed
      rounded-xl backdrop-blur-sm
    `;

    const variants = {
      primary: `
        bg-linear-to-r from-cyan-500 to-blue-500
        hover:from-cyan-400 hover:to-blue-400
        text-white shadow-lg shadow-cyan-500/25
        hover:shadow-cyan-500/40 hover:scale-[1.02]
        focus:ring-cyan-500
        border border-cyan-400/20
      `,
      secondary: `
        bg-slate-800/80 hover:bg-slate-700/80
        text-slate-100
        border border-slate-600/50 hover:border-slate-500/50
        focus:ring-slate-500
      `,
      ghost: `
        bg-transparent hover:bg-slate-800/50
        text-slate-300 hover:text-white
        focus:ring-slate-500
      `,
      danger: `
        bg-linear-to-r from-red-500 to-rose-500
        hover:from-red-400 hover:to-rose-400
        text-white shadow-lg shadow-red-500/25
        hover:shadow-red-500/40
        focus:ring-red-500
        border border-red-400/20
      `,
      success: `
        bg-linear-to-r from-emerald-500 to-green-500
        hover:from-emerald-400 hover:to-green-400
        text-white shadow-lg shadow-emerald-500/25
        hover:shadow-emerald-500/40
        focus:ring-emerald-500
        border border-emerald-400/20
      `,
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm gap-1.5',
      md: 'px-4 py-2.5 text-sm gap-2',
      lg: 'px-6 py-3 text-base gap-2.5',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
