import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'gradient' | 'glow';
  hover?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', hover = false, children, ...props }, ref) => {
    const baseStyles = `
      rounded-2xl backdrop-blur-xl
      transition-all duration-300 ease-out
    `;

    const variants = {
      default: `
        bg-slate-800/50 border border-slate-700/50
        ${hover ? 'hover:bg-slate-800/70 hover:border-slate-600/50 hover:scale-[1.01]' : ''}
      `,
      gradient: `
        bg-linear-to-br from-slate-800/80 via-slate-800/50 to-slate-900/80
        border border-slate-700/30
        ${hover ? 'hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/10' : ''}
      `,
      glow: `
        bg-slate-800/50 border border-cyan-500/20
        shadow-lg shadow-cyan-500/5
        ${hover ? 'hover:border-cyan-500/40 hover:shadow-cyan-500/20' : ''}
      `,
    };

    return (
      <div
        ref={ref}
        className={cn(baseStyles, variants[variant], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('px-6 py-4 border-b border-slate-700/50', className)}
      {...props}
    />
  )
);

CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-lg font-semibold text-white', className)}
      {...props}
    />
  )
);

CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-slate-400 mt-1', className)}
      {...props}
    />
  )
);

CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('px-6 py-4', className)}
      {...props}
    />
  )
);

CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('px-6 py-4 border-t border-slate-700/50', className)}
      {...props}
    />
  )
);

CardFooter.displayName = 'CardFooter';
