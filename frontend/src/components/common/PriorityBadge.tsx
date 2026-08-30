import React from 'react';
import { BugPriority } from '../../types';
import { Flame, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react';

interface PriorityBadgeProps {
  priority: BugPriority;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, showIcon = true, size = 'sm' }) => {
  const configs: Record<BugPriority, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
    P1: {
      label: 'P1 Critical',
      bg: 'bg-rose-500/15 dark:bg-rose-500/20',
      text: 'text-rose-700 dark:text-rose-400 font-semibold',
      border: 'border-rose-300 dark:border-rose-500/30',
      icon: <Flame className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" aria-hidden="true" />
    },
    P2: {
      label: 'P2 High',
      bg: 'bg-amber-500/15 dark:bg-amber-500/20',
      text: 'text-amber-700 dark:text-amber-400 font-semibold',
      border: 'border-amber-300 dark:border-amber-500/30',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
    },
    P3: {
      label: 'P3 Medium',
      bg: 'bg-blue-500/15 dark:bg-blue-500/20',
      text: 'text-blue-700 dark:text-blue-400 font-medium',
      border: 'border-blue-300 dark:border-blue-500/30',
      icon: <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
    },
    P4: {
      label: 'P4 Low',
      bg: 'bg-slate-500/15 dark:bg-slate-500/20',
      text: 'text-slate-700 dark:text-slate-400 font-medium',
      border: 'border-slate-300 dark:border-slate-500/30',
      icon: <ArrowDown className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 shrink-0" aria-hidden="true" />
    }
  };

  const cfg = configs[priority] || configs.P3;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border ${padding} ${cfg.bg} ${cfg.text} ${cfg.border} transition-colors select-none`}
      title={`Priority Level: ${cfg.label}`}
    >
      {showIcon && cfg.icon}
      <span>{cfg.label}</span>
    </span>
  );
};
