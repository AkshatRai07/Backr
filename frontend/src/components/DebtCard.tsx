'use client';

import { Card, CardContent, Badge, Button } from '@/components/ui';
import { formatAddress, formatCurrency, formatRelativeTime, getDebtStatusColor } from '@/lib/utils';
import { Debt } from '@/lib/api';

interface DebtCardProps {
  debt: Debt;
  onRepay?: (debt: Debt) => void;
  isLender?: boolean;
}

export function DebtCard({ debt, onRepay, isLender = false }: DebtCardProps) {
  const progress = ((debt.original_amount - debt.amount_owed) / debt.original_amount) * 100;
  const statusColor = getDebtStatusColor(debt.status);
  const isOverdue = new Date(debt.due_date) < new Date() && debt.status !== 'paid';

  return (
    <Card variant="default" hover className="overflow-hidden">
      {/* Status bar at top */}
      <div className={`h-1 ${
        debt.status === 'paid' ? 'bg-emerald-500' :
        debt.status === 'overdue' ? 'bg-orange-500' :
        debt.status === 'defaulted' ? 'bg-red-500' :
        'bg-cyan-500'
      }`} />
      
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">
              {isLender ? 'Lent to' : 'Borrowed from'}
            </p>
            <p className="text-sm font-medium text-white">
              {formatAddress(isLender ? debt.borrower_address : debt.lender_address)}
            </p>
          </div>
          <Badge
            variant={
              debt.status === 'paid' ? 'success' :
              debt.status === 'overdue' ? 'warning' :
              debt.status === 'defaulted' ? 'danger' :
              'info'
            }
            size="sm"
          >
            {debt.status.charAt(0).toUpperCase() + debt.status.slice(1)}
          </Badge>
        </div>

        {/* Amount */}
        <div className="mb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {formatCurrency(debt.amount_owed)}
            </span>
            <span className="text-sm text-slate-500">
              / {formatCurrency(debt.original_amount)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">remaining to pay</p>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Repayment Progress</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                debt.status === 'paid' ? 'bg-emerald-500' :
                debt.status === 'overdue' ? 'bg-orange-500' :
                'bg-cyan-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Due date */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <svg
              className={`w-4 h-4 ${isOverdue ? 'text-orange-400' : 'text-slate-400'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className={isOverdue ? 'text-orange-400' : 'text-slate-400'}>
              {debt.status === 'paid' 
                ? `Paid ${formatRelativeTime(debt.paid_at!)}`
                : isOverdue 
                  ? `Overdue ${formatRelativeTime(debt.due_date)}`
                  : `Due ${formatRelativeTime(debt.due_date)}`
              }
            </span>
          </div>

          {/* Repay button (only for borrower with active debts) */}
          {!isLender && debt.status !== 'paid' && onRepay && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onRepay(debt)}
            >
              Repay
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Compact list item version
export function DebtListItem({ debt, onRepay, isLender = false }: DebtCardProps) {
  const isOverdue = new Date(debt.due_date) < new Date() && debt.status !== 'paid';

  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/30 border border-slate-700/30 hover:border-slate-600/50 transition-all">
      <div className="flex items-center gap-4">
        <div className={`w-2 h-2 rounded-full ${
          debt.status === 'paid' ? 'bg-emerald-500' :
          debt.status === 'overdue' ? 'bg-orange-500' :
          debt.status === 'defaulted' ? 'bg-red-500' :
          'bg-cyan-500'
        }`} />
        <div>
          <p className="text-sm font-medium text-white">
            {formatCurrency(debt.amount_owed)}
            <span className="text-slate-500 text-xs ml-1">
              of {formatCurrency(debt.original_amount)}
            </span>
          </p>
          <p className="text-xs text-slate-500">
            {isLender ? 'to' : 'from'} {formatAddress(isLender ? debt.borrower_address : debt.lender_address)}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <span className={`text-xs ${isOverdue ? 'text-orange-400' : 'text-slate-400'}`}>
          {debt.status === 'paid' ? 'Paid' : formatRelativeTime(debt.due_date)}
        </span>
        {!isLender && debt.status !== 'paid' && onRepay && (
          <Button size="sm" variant="ghost" onClick={() => onRepay(debt)}>
            Pay
          </Button>
        )}
      </div>
    </div>
  );
}
