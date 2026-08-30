import React from 'react';
import { BugSeverity } from '../../types';
import { ShieldAlert, AlertCircle, AlertOctagon, Info } from 'lucide-react';

interface SeverityBadgeProps {
  severity: BugSeverity;
  size?: 'sm' | 'md';
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, size = 'sm' }) => {
  const configs: Record<BugSeverity, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
    CRITICAL: {
      label: 'Critical',
      bg: 'bg-red-500/15 dark:bg-red-500/20',
      text: 'text-red-700 dark:text-red-300 font-semibold',
      border: 'border-red-300 dark:border-red-500/30',
      icon: <AlertOctagon className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />
    },
    HIGH: {
      label: 'High',
      bg: 'bg-orange-500/15 dark:bg-orange-500/20',
      text: 'text-orange-700 dark:text-orange-300 font-semibold',
      border: 'border-orange-300 dark:border-orange-500/30',
      icon: <ShieldAlert className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 shrink-0" aria-hidden="true" />
    },
    MEDIUM: {
      label: 'Medium',
      bg: 'bg-amber-500/15 dark:bg-amber-500/20',
      text: 'text-amber-700 dark:text-amber-300 font-medium',
      border: 'border-amber-300 dark:border-amber-500/30',
      icon: <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
    },
    LOW: {
      label: 'Low',
      bg: 'bg-slate-500/15 dark:bg-slate-500/20',
      text: 'text-slate-700 dark:text-slate-300 font-medium',
      border: 'border-slate-300 dark:border-slate-500/30',
      icon: <Info className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 shrink-0" aria-hidden="true" />
    }
  };

  const cfg = configs[severity] || configs.MEDIUM;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border ${padding} ${cfg.bg} ${cfg.text} ${cfg.border} transition-colors select-none`}
      title={`Severity: ${cfg.label}`}
    >
      {cfg.icon}
      <span>{cfg.label}</span>
    </span>
  );
};
