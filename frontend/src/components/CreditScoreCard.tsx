'use client';

import { Card, CardContent, Progress } from '@/components/ui';
import { getCreditScoreColor, getCreditScoreLabel } from '@/lib/utils';

interface CreditScoreCardProps {
  score: number;
  showDetails?: boolean;
  className?: string;
}

export function CreditScoreCard({ score, showDetails = true, className }: CreditScoreCardProps) {
  const scorePercentage = ((score - 300) / 600) * 100;
  const scoreColor = getCreditScoreColor(score);
  const scoreLabel = getCreditScoreLabel(score);

  // Get color values for the gradient
  const getScoreGradient = (score: number) => {
    if (score >= 750) return 'from-emerald-500 to-green-400';
    if (score >= 650) return 'from-cyan-500 to-blue-400';
    if (score >= 500) return 'from-yellow-500 to-orange-400';
    if (score >= 400) return 'from-orange-500 to-red-400';
    return 'from-red-500 to-rose-400';
  };

  return (
    <Card variant="gradient" className={className}>
      <CardContent className="p-6">
        {/* Score Display */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-slate-400 mb-1">Credit Score</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold ${scoreColor}`}>
                {score}
              </span>
              <span className="text-sm text-slate-500">/ 900</span>
            </div>
          </div>
          
          {/* Score badge */}
          <div className={`px-3 py-1.5 rounded-xl bg-linear-to-r ${getScoreGradient(score)} bg-opacity-20`}>
            <span className={`text-sm font-semibold ${scoreColor}`}>
              {scoreLabel}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="relative h-3 bg-slate-700/50 rounded-full overflow-hidden">
            {/* Score markers */}
            <div className="absolute inset-0 flex">
              <div className="w-1/6 border-r border-slate-600/50" /> {/* 400 */}
              <div className="w-1/6 border-r border-slate-600/50" /> {/* 500 */}
              <div className="w-1/6 border-r border-slate-600/50" /> {/* 600 */}
              <div className="w-1/6 border-r border-slate-600/50" /> {/* 700 */}
              <div className="w-1/6 border-r border-slate-600/50" /> {/* 800 */}
              <div className="w-1/6" />
            </div>
            
            {/* Progress fill */}
            <div
              className={`absolute left-0 top-0 h-full rounded-full bg-linear-to-r ${getScoreGradient(score)} transition-all duration-500`}
              style={{ width: `${scorePercentage}%` }}
            />
          </div>
          
          {/* Score range labels */}
          <div className="flex justify-between text-xs text-slate-500">
            <span>300</span>
            <span>500</span>
            <span>700</span>
            <span>900</span>
          </div>
        </div>

        {showDetails && (
          <div className="mt-6 pt-4 border-t border-slate-700/50">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-400">ENS Strip Threshold</p>
                <p className="text-red-400 font-medium">Below 400</p>
              </div>
              <div>
                <p className="text-slate-400">Points to Next Level</p>
                <p className="text-cyan-400 font-medium">
                  {score >= 750 ? 'Max Level' : `${Math.ceil((Math.ceil(score / 100) * 100) - score + 50)} pts`}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact version for smaller displays
export function CreditScoreBadge({ score }: { score: number }) {
  const scoreColor = getCreditScoreColor(score);
  
  return (
    <div className="flex items-center gap-2">
      <div className={`text-lg font-bold ${scoreColor}`}>{score}</div>
      <div className="text-xs text-slate-500">/ 900</div>
    </div>
  );
}
