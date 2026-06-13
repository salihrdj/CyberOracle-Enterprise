export const TT = {
  backgroundColor: 'rgba(15,15,30,0.9)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px',
  color: '#e2e8f0',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
};

export function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

export function formatCurrency(num: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatPercentage(num: number): string {
  return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
}

export function getRiskLevelColor(level: string): string {
  switch (level) {
    case 'CRITICAL': return '#fb7185';
    case 'HIGH': return '#fbbf24';
    case 'MEDIUM': return '#38bdf8';
    case 'LOW': return '#34d399';
    default: return '#64748b';
  }
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'Critical': return '#fb7185';
    case 'High': return '#f97316';
    case 'Medium': return '#fbbf24';
    case 'Low': return '#34d399';
    case 'Info': return '#38bdf8';
    default: return '#64748b';
  }
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '…';
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}