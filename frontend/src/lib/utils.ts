// Simple class name combiner (no external dependencies)
type ClassValue = string | boolean | null | undefined | Record<string, boolean>;

export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];
  
  for (const input of inputs) {
    if (!input) continue;
    
    if (typeof input === 'string') {
      classes.push(input);
    } else if (typeof input === 'object') {
      for (const [key, value] of Object.entries(input)) {
        if (value) classes.push(key);
      }
    }
  }
  
  return classes.join(' ');
}

// Validate Ethereum address
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Format address to show first and last 4 characters
export function formatAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// Format currency
export function formatCurrency(amount: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

// Format date
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

// Format relative time
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diff = then.getTime() - now.getTime();
  const absDiff = Math.abs(diff);
  
  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  const isFuture = diff > 0;
  const prefix = isFuture ? 'in ' : '';
  const suffix = isFuture ? '' : ' ago';
  
  if (days > 0) return `${prefix}${days} day${days > 1 ? 's' : ''}${suffix}`;
  if (hours > 0) return `${prefix}${hours} hour${hours > 1 ? 's' : ''}${suffix}`;
  if (minutes > 0) return `${prefix}${minutes} minute${minutes > 1 ? 's' : ''}${suffix}`;
  return `${prefix}${seconds} second${seconds !== 1 ? 's' : ''}${suffix}`;
}

// Get credit score color
export function getCreditScoreColor(score: number): string {
  if (score >= 750) return 'text-emerald-400';
  if (score >= 650) return 'text-cyan-400';
  if (score >= 500) return 'text-yellow-400';
  if (score >= 400) return 'text-orange-400';
  return 'text-red-400';
}

// Get credit score label
export function getCreditScoreLabel(score: number): string {
  if (score >= 750) return 'Excellent';
  if (score >= 650) return 'Good';
  if (score >= 500) return 'Fair';
  if (score >= 400) return 'Poor';
  return 'Very Poor';
}

// Get debt status color
export function getDebtStatusColor(status: string): string {
  switch (status) {
    case 'paid':
      return 'text-emerald-400 bg-emerald-400/10';
    case 'active':
      return 'text-cyan-400 bg-cyan-400/10';
    case 'overdue':
      return 'text-orange-400 bg-orange-400/10';
    case 'defaulted':
      return 'text-red-400 bg-red-400/10';
    default:
      return 'text-gray-400 bg-gray-400/10';
  }
}

// Calculate progress percentage
export function calculateProgress(current: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(100, Math.max(0, (current / total) * 100));
}

// Generate random gradient for avatar
export function getAvatarGradient(address: string): string {
  const hash = address.slice(2, 10);
  const hue1 = parseInt(hash.slice(0, 4), 16) % 360;
  const hue2 = (hue1 + 60) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 70%, 50%), hsl(${hue2}, 70%, 50%))`;
}

// Clsx implementation for class merging
type ClassDictionary = Record<string, boolean | undefined | null>;
type ClassArray = ClassValue[];

function clsx(...inputs: ClassValue[]): string {
  const classes: string[] = [];
  
  for (const input of inputs) {
    if (!input) continue;
    
    if (typeof input === 'string') {
      classes.push(input);
    } else if (typeof input === 'number') {
      classes.push(String(input));
    } else if (Array.isArray(input)) {
      const inner = clsx(...input);
      if (inner) classes.push(inner);
    } else if (typeof input === 'object') {
      for (const [key, value] of Object.entries(input as ClassDictionary)) {
        if (value) classes.push(key);
      }
    }
  }
  
  return classes.join(' ');
}

export type { ClassValue, ClassDictionary, ClassArray };
