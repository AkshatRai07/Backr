'use client';

import { useState } from 'react';
import { Button, Input, Label, Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from '@/components/ui';
import { formatCurrency, isValidEthereumAddress } from '@/lib/utils';
import { Vouch } from '@/lib/api';

interface BorrowFormProps {
  availableVouches: Vouch[];
  maxBorrowAmount: number;
  onSubmit: (data: {
    lenderAddress: string;
    amount: number;
    durationDays: number;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function BorrowForm({ availableVouches, maxBorrowAmount, onSubmit, isLoading = false }: BorrowFormProps) {
  const [selectedVouch, setSelectedVouch] = useState<Vouch | null>(null);
  const [lenderAddress, setLenderAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [durationDays, setDurationDays] = useState('30');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const durationOptions = [
    { days: 7, label: '1 Week' },
    { days: 14, label: '2 Weeks' },
    { days: 30, label: '1 Month' },
    { days: 60, label: '2 Months' },
    { days: 90, label: '3 Months' },
  ];

  // Filter vouches to only show active ones with available credit
  const activeVouches = availableVouches.filter(
    v => v.status === 'active' && v.amount - v.utilized_amount > 0
  );

  const handleVouchSelect = (vouch: Vouch) => {
    setSelectedVouch(vouch);
    setLenderAddress(vouch.voucher_address);
    // Auto-fill max available amount
    const available = vouch.amount - vouch.utilized_amount;
    if (!amount || parseFloat(amount) > available) {
      setAmount(available.toString());
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!lenderAddress) {
      newErrors.lenderAddress = 'Lender address is required';
    } else if (!isValidEthereumAddress(lenderAddress)) {
      newErrors.lenderAddress = 'Invalid Ethereum address';
    }

    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum)) {
      newErrors.amount = 'Amount is required';
    } else if (amountNum <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    } else if (amountNum > maxBorrowAmount) {
      newErrors.amount = `Amount cannot exceed ${formatCurrency(maxBorrowAmount)}`;
    } else if (selectedVouch) {
      const available = selectedVouch.amount - selectedVouch.utilized_amount;
      if (amountNum > available) {
        newErrors.amount = `Amount cannot exceed available credit (${formatCurrency(available)})`;
      }
    }

    const duration = parseInt(durationDays);
    if (isNaN(duration) || duration < 1) {
      newErrors.durationDays = 'Valid duration is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({
      lenderAddress,
      amount: parseFloat(amount),
      durationDays: parseInt(durationDays),
    });
  };

  return (
    <Card variant="gradient">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Borrow Funds</CardTitle>
          <CardDescription>
            Borrow against your received vouches
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Available vouches */}
          {activeVouches.length > 0 && (
            <div className="space-y-2">
              <Label>Select from your vouches</Label>
              <div className="grid gap-2 max-h-48 overflow-y-auto pr-2">
                {activeVouches.map((vouch) => {
                  const available = vouch.amount - vouch.utilized_amount;
                  const isSelected = selectedVouch?.id === vouch.id;
                  
                  return (
                    <button
                      key={vouch.id}
                      type="button"
                      onClick={() => handleVouchSelect(vouch)}
                      className={`p-3 rounded-xl text-left transition-all ${
                        isSelected
                          ? 'bg-cyan-500/20 border-2 border-cyan-500/50'
                          : 'bg-slate-800/30 border-2 border-transparent hover:border-slate-600/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {vouch.voucher_address.slice(0, 6)}...{vouch.voucher_address.slice(-4)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatCurrency(available)} available
                          </p>
                        </div>
                        {isSelected && (
                          <svg className="w-5 h-5 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Or manual entry */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700/50" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-2 text-slate-500">or enter manually</span>
            </div>
          </div>

          {/* Lender address */}
          <div className="space-y-2">
            <Label htmlFor="lender">Lender Address</Label>
            <Input
              id="lender"
              type="text"
              placeholder="0x..."
              value={lenderAddress}
              onChange={(e) => {
                setLenderAddress(e.target.value);
                setSelectedVouch(null);
              }}
              error={errors.lenderAddress}
              disabled={isLoading}
            />
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="borrowAmount">
              Amount (USD)
              {selectedVouch && (
                <span className="ml-2 text-xs text-slate-500">
                  Max: {formatCurrency(selectedVouch.amount - selectedVouch.utilized_amount)}
                </span>
              )}
            </Label>
            <Input
              id="borrowAmount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={errors.amount}
              disabled={isLoading}
              min={0}
              step="0.01"
            />
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Repayment Duration</Label>
            <div className="flex flex-wrap gap-2">
              {durationOptions.map((option) => (
                <button
                  key={option.days}
                  type="button"
                  onClick={() => setDurationDays(option.days.toString())}
                  className={`px-4 py-2 text-sm rounded-xl transition-all ${
                    durationDays === option.days.toString()
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                      : 'bg-slate-700/30 text-slate-400 border border-slate-700/50 hover:border-slate-600'
                  }`}
                  disabled={isLoading}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {errors.durationDays && (
              <p className="text-xs text-red-400">{errors.durationDays}</p>
            )}
          </div>

          {/* Summary */}
          {amount && lenderAddress && (
            <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
              <h4 className="text-sm font-medium text-white mb-3">Loan Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Borrow Amount</span>
                  <span className="text-white">{formatCurrency(parseFloat(amount) || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Duration</span>
                  <span className="text-white">{durationDays} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Due Date</span>
                  <span className="text-white">
                    {new Date(Date.now() + parseInt(durationDays) * 24 * 60 * 60 * 1000).toLocaleDateString()}
                  </span>
                </div>
                <div className="border-t border-slate-700/30 my-2" />
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount to Repay</span>
                  <span className="text-cyan-400 font-semibold">{formatCurrency(parseFloat(amount) || 0)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-sm text-slate-300">
                <p className="font-medium text-orange-400 mb-1">Important</p>
                <p className="text-slate-400">
                  Failure to repay on time will negatively affect your credit score and may impact 
                  your voucher's reputation.
                </p>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={isLoading}
            disabled={!lenderAddress || !amount || isLoading}
          >
            Request Loan
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
