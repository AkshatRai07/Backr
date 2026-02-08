'use client';

import { useState } from 'react';
import { Button, Input, Label, Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from '@/components/ui';
import { formatCurrency, isValidEthereumAddress } from '@/lib/utils';

interface VouchFormProps {
  onSubmit: (data: {
    voucheeAddress: string;
    amount: number;
    message?: string;
  }) => Promise<void>;
  maxAmount?: number;
  isLoading?: boolean;
}

export function VouchForm({ onSubmit, maxAmount = 10000, isLoading = false }: VouchFormProps) {
  const [voucheeAddress, setVoucheeAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const presetAmounts = [100, 500, 1000, 5000];

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!voucheeAddress) {
      newErrors.voucheeAddress = 'Address is required';
    } else if (!isValidEthereumAddress(voucheeAddress)) {
      newErrors.voucheeAddress = 'Invalid Ethereum address';
    }

    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum)) {
      newErrors.amount = 'Amount is required';
    } else if (amountNum <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    } else if (amountNum > maxAmount) {
      newErrors.amount = `Amount cannot exceed ${formatCurrency(maxAmount)}`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({
      voucheeAddress,
      amount: parseFloat(amount),
      message: message || undefined,
    });
  };

  return (
    <Card variant="gradient">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Create a Vouch</CardTitle>
          <CardDescription>
            Vouch for someone to give them credit backing
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Recipient address */}
          <div className="space-y-2">
            <Label htmlFor="vouchee">Recipient Address</Label>
            <Input
              id="vouchee"
              type="text"
              placeholder="0x..."
              value={voucheeAddress}
              onChange={(e) => setVoucheeAddress(e.target.value)}
              error={errors.voucheeAddress}
              disabled={isLoading}
            />
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Vouch Amount (USD)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={errors.amount}
              disabled={isLoading}
              min={0}
              max={maxAmount}
              step="0.01"
            />
            
            {/* Preset amounts */}
            <div className="flex flex-wrap gap-2 mt-2">
              {presetAmounts.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset.toString())}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                    amount === preset.toString()
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                      : 'bg-slate-700/30 text-slate-400 border border-slate-700/50 hover:border-slate-600'
                  }`}
                  disabled={isLoading}
                >
                  {formatCurrency(preset)}
                </button>
              ))}
            </div>
          </div>

          {/* Optional message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message (Optional)</Label>
            <textarea
              id="message"
              rows={3}
              placeholder="Add a note for the recipient..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isLoading}
              maxLength={500}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 
                text-white placeholder:text-slate-500 text-sm
                focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
                transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 text-right">
              {message.length}/500
            </p>
          </div>

          {/* Info box */}
          <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-slate-300">
                <p className="font-medium text-cyan-400 mb-1">How vouching works</p>
                <p className="text-slate-400">
                  When you vouch for someone, you're backing their credit limit up to the amount you specify. 
                  If they default, your reputation score may be affected.
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
          >
            Create Vouch
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
