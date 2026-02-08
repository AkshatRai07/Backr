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
  const otherAddress = isGiven ? vouch.vouchee_address : vouch.voucher_address;
  const canActivate = vouch.status === 'pending' && isGiven;
  const canRevoke = vouch.status === 'active' && isGiven;

  return (
    <Card variant="default" hover className="overflow-hidden group">
      {/* Status indicator */}
      <div className={`h-1 ${
        vouch.status === 'active' ? 'bg-emerald-500' :
        vouch.status === 'pending' ? 'bg-yellow-500' :
        vouch.status === 'revoked' ? 'bg-red-500' :
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
                background: `linear-gradient(135deg, 
                  hsl(${parseInt(otherAddress.slice(2, 10), 16) % 360}, 70%, 50%),
                  hsl(${parseInt(otherAddress.slice(10, 18), 16) % 360}, 70%, 50%))`,
              }}
            >
              {otherAddress.slice(2, 4).toUpperCase()}
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">
                {isGiven ? 'Vouching for' : 'Vouched by'}
              </p>
              <p className="text-sm font-medium text-white">
                {formatAddress(otherAddress)}
              </p>
            </div>
          </div>
          <Badge
            variant={
              vouch.status === 'active' ? 'success' :
              vouch.status === 'pending' ? 'warning' :
              vouch.status === 'revoked' ? 'danger' :
              'default'
            }
            size="sm"
          >
            {vouch.status.charAt(0).toUpperCase() + vouch.status.slice(1)}
          </Badge>
        </div>

        {/* Amount */}
        <div className="mb-4">
          <p className="text-xs text-slate-500 mb-1">Credit Limit</p>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(vouch.amount)}
          </p>
          {vouch.utilized_amount > 0 && (
            <p className="text-xs text-cyan-400 mt-1">
              {formatCurrency(vouch.utilized_amount)} utilized
            </p>
          )}
        </div>

        {/* Utilization bar if active */}
        {vouch.status === 'active' && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Utilization</span>
              <span>{((vouch.utilized_amount / vouch.amount) * 100).toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${(vouch.utilized_amount / vouch.amount) * 100}%` }}
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
  const otherAddress = isGiven ? vouch.vouchee_address : vouch.voucher_address;
  const canActivate = vouch.status === 'pending' && isGiven;
  const canRevoke = vouch.status === 'active' && isGiven;

  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/30 border border-slate-700/30 hover:border-slate-600/50 transition-all">
      <div className="flex items-center gap-4">
        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full ${
          vouch.status === 'active' ? 'bg-emerald-500' :
          vouch.status === 'pending' ? 'bg-yellow-500' :
          'bg-slate-500'
        }`} />
        
        {/* Avatar */}
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{
            background: `linear-gradient(135deg, 
              hsl(${parseInt(otherAddress.slice(2, 10), 16) % 360}, 70%, 50%),
              hsl(${parseInt(otherAddress.slice(10, 18), 16) % 360}, 70%, 50%))`,
          }}
        >
          {otherAddress.slice(2, 4).toUpperCase()}
        </div>
        
        <div>
          <p className="text-sm font-medium text-white">
            {formatCurrency(vouch.amount)}
          </p>
          <p className="text-xs text-slate-500">
            {isGiven ? 'to' : 'from'} {formatAddress(otherAddress)}
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
            variant={vouch.status === 'active' ? 'success' : 'default'}
            size="sm"
          >
            {vouch.status}
          </Badge>
        )}
      </div>
    </div>
  );
}
