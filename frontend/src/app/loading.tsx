'use client';

export default function Loading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      {/* Animated logo */}
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-cyan-500 to-blue-600 animate-pulse" />
        <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-linear-to-br from-cyan-500 to-blue-600 animate-ping opacity-20" />
      </div>
      
      {/* Loading text */}
      <div className="mt-6 flex items-center gap-2">
        <span className="text-slate-400">Loading</span>
        <span className="flex gap-1">
          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </span>
      </div>
    </div>
  );
}
