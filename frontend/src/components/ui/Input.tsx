import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, type, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {icon}
            </div>
          )}
          <input
            type={type}
            ref={ref}
            className={cn(
              `
              w-full px-4 py-3 rounded-xl
              bg-slate-800/50 border border-slate-700/50
              text-white placeholder-slate-500
              focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
              transition-all duration-200
              backdrop-blur-sm
              ${icon ? 'pl-10' : ''}
              ${error ? 'border-red-500/50 focus:ring-red-500/50' : ''}
            `,
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Label component
interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
}

export const Label = ({ className, children, ...props }: LabelProps) => {
  return (
    <label
      className={cn(
        'block text-sm font-medium text-slate-300',
        className
      )}
      {...props}
    >
      {children}
    </label>
  );
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            `
            w-full px-4 py-3 rounded-xl
            bg-slate-800/50 border border-slate-700/50
            text-white placeholder-slate-500
            focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
            transition-all duration-200
            backdrop-blur-sm resize-none
            ${error ? 'border-red-500/50 focus:ring-red-500/50' : ''}
          `,
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-2 text-sm text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
