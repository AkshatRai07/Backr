'use client';

import { Card, CardContent, Badge, Button } from '@/components/ui';
import { formatAddress, formatCurrency, formatRelativeTime } from '@/lib/utils';
import { Vouch, VouchStatus } from '@/lib/api';

interface VouchCardProps {
  vouch: Vouch;
  isGiven?: boolean; // true if user gave this vouch, false if received
  onActivate?: (vouch: Vouch) => void;
  onRevoke?: (vouch: Vouch) => void;
}

export function VouchCard({ vouch, isGiven = false, onActivate, onRevoke }: VouchCardProps) {
  // Handle both field name conventions (vouchee_address or borrower_address)
  const borrowerAddress = vouch.vouchee_address || vouch.borrower_address || '';
  const otherAddress = isGiven ? borrowerAddress : vouch.voucher_address;
  
  // Derive status from is_active if status is not provided
  const status: VouchStatus = vouch.status || (vouch.is_active ? 'active' : 'revoked');
  
  const canActivate = status === 'pending' && isGiven;
  const canRevoke = status === 'active' && isGiven;
  
  // Get amount from either field name
  const amount = vouch.amount || vouch.limit_amount || 0;
  const utilizedAmount = vouch.utilized_amount || vouch.current_usage || 0;

  return (
    <Card variant="default" hover className="overflow-hidden group">
      {/* Status indicator */}
      <div className={`h-1 ${
        status === 'active' ? 'bg-emerald-500' :
        status === 'pending' ? 'bg-yellow-500' :
        status === 'revoked' ? 'bg-red-500' :
        'bg-slate-500'
      }`} />
      
      <CardContent className="p-5">
        {/* Header with avatar and status */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Gradient avatar */}
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{
                background: otherAddress ? `linear-gradient(135deg, 
                  hsl(${parseInt(otherAddress.slice(2, 10), 16) % 360}, 70%, 50%),
                  hsl(${parseInt(otherAddress.slice(10, 18), 16) % 360}, 70%, 50%))` : 
                  'linear-gradient(135deg, hsl(200, 70%, 50%), hsl(250, 70%, 50%))',
              }}
            >
              {otherAddress ? otherAddress.slice(2, 4).toUpperCase() : '??'}
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">
                {isGiven ? 'Vouching for' : 'Vouched by'}
              </p>
              <p className="text-sm font-medium text-white">
                {otherAddress ? formatAddress(otherAddress) : 'Unknown'}
              </p>
            </div>
          </div>
          <Badge
            variant={
              status === 'active' ? 'success' :
              status === 'pending' ? 'warning' :
              status === 'revoked' ? 'danger' :
              'default'
            }
            size="sm"
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>

        {/* Amount */}
        <div className="mb-4">
          <p className="text-xs text-slate-500 mb-1">Credit Limit</p>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(amount)}
          </p>
          {utilizedAmount > 0 && (
            <p className="text-xs text-cyan-400 mt-1">
              {formatCurrency(utilizedAmount)} utilized
            </p>
          )}
        </div>

        {/* Utilization bar if active */}
        {status === 'active' && amount > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Utilization</span>
              <span>{((utilizedAmount / amount) * 100).toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${(utilizedAmount / amount) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Timestamp and actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-700/30">
          <span className="text-xs text-slate-500">
            Created {vouch.created_at ? formatRelativeTime(vouch.created_at) : 'recently'}
          </span>
          
          <div className="flex gap-2">
            {canActivate && onActivate && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onActivate(vouch)}
              >
                Activate
              </Button>
            )}
            {canRevoke && onRevoke && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => onRevoke(vouch)}
              >
                Revoke
              </Button>
            )}
          </div>
        </div>

        {/* Message if exists */}
        {vouch.message && (
          <div className="mt-3 p-3 rounded-lg bg-slate-700/20 border border-slate-700/30">
            <p className="text-xs text-slate-400 italic">"{vouch.message}"</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact list version
export function VouchListItem({ vouch, isGiven = false, onActivate, onRevoke }: VouchCardProps) {
  // Handle both field name conventions
  const borrowerAddress = vouch.vouchee_address || vouch.borrower_address || '';
  const otherAddress = isGiven ? borrowerAddress : (vouch.voucher_address || '');
  
  // Derive status from is_active if status is not provided
  const status: VouchStatus = vouch.status || (vouch.is_active ? 'active' : 'revoked');
  
  const canActivate = status === 'pending' && isGiven;
  const canRevoke = status === 'active' && isGiven;
  
  // Get amount from either field name
  const amount = vouch.amount || vouch.limit_amount || 0;

  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/30 border border-slate-700/30 hover:border-slate-600/50 transition-all">
      <div className="flex items-center gap-4">
        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full ${
          status === 'active' ? 'bg-emerald-500' :
          status === 'pending' ? 'bg-yellow-500' :
          'bg-slate-500'
        }`} />
        
        {/* Avatar */}
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{
            background: otherAddress ? `linear-gradient(135deg, 
              hsl(${parseInt(otherAddress.slice(2, 10), 16) % 360}, 70%, 50%),
              hsl(${parseInt(otherAddress.slice(10, 18), 16) % 360}, 70%, 50%))` :
              'linear-gradient(135deg, hsl(200, 70%, 50%), hsl(250, 70%, 50%))',
          }}
        >
          {otherAddress ? otherAddress.slice(2, 4).toUpperCase() : '??'}
        </div>
        
        <div>
          <p className="text-sm font-medium text-white">
            {formatCurrency(amount)}
          </p>
          <p className="text-xs text-slate-500">
            {isGiven ? 'to' : 'from'} {otherAddress ? formatAddress(otherAddress) : 'Unknown'}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {canActivate && onActivate && (
          <Button size="sm" variant="ghost" onClick={() => onActivate(vouch)}>
            Activate
          </Button>
        )}
        {canRevoke && onRevoke && (
          <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => onRevoke(vouch)}>
            Revoke
          </Button>
        )}
        {!canActivate && !canRevoke && (
          <Badge
            variant={status === 'active' ? 'success' : 'default'}
            size="sm"
          >
            {status}
          </Badge>
        )}
      </div>
    </div>
  );
}
