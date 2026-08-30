import React from 'react';
import { BugStatus } from '../../types';

interface StatusBadgeProps {
  status: BugStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const configs: Record<BugStatus, { label: string; dot: string; bg: string; text: string; border: string }> = {
    REPORTED: {
      label: 'Reported',
      dot: 'bg-blue-500',
      bg: 'bg-blue-500/10 dark:bg-blue-500/15',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-500/20'
    },
    NEW: {
      label: 'Reported',
      dot: 'bg-blue-500',
      bg: 'bg-blue-500/10 dark:bg-blue-500/15',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-500/20'
    },
    AI_TRIAGE: {
      label: 'AI Triage',
      dot: 'bg-purple-500',
      bg: 'bg-purple-500/10 dark:bg-purple-500/15',
      text: 'text-purple-700 dark:text-purple-300',
      border: 'border-purple-200 dark:border-purple-500/20'
    },
    TRIAGED: {
      label: 'AI Triage',
      dot: 'bg-purple-500',
      bg: 'bg-purple-500/10 dark:bg-purple-500/15',
      text: 'text-purple-700 dark:text-purple-300',
      border: 'border-purple-200 dark:border-purple-500/20'
    },
    ASSIGNED: {
      label: 'Assigned',
      dot: 'bg-indigo-500',
      bg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
      text: 'text-indigo-700 dark:text-indigo-300',
      border: 'border-indigo-200 dark:border-indigo-500/20'
    },
    IN_DEVELOPMENT: {
      label: 'In Development',
      dot: 'bg-amber-500 animate-pulse',
      bg: 'bg-amber-500/10 dark:bg-amber-500/15',
      text: 'text-amber-700 dark:text-amber-300 font-medium',
      border: 'border-amber-200 dark:border-amber-500/20'
    },
    CODE_REVIEW: {
      label: 'Code Review',
      dot: 'bg-cyan-500',
      bg: 'bg-cyan-500/10 dark:bg-cyan-500/15',
      text: 'text-cyan-700 dark:text-cyan-300 font-medium',
      border: 'border-cyan-200 dark:border-cyan-500/20'
    },
    RESOLVED: {
      label: 'Resolved',
      dot: 'bg-emerald-500',
      bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
      text: 'text-emerald-700 dark:text-emerald-300 font-semibold',
      border: 'border-emerald-200 dark:border-emerald-500/20'
    },
    READY_FOR_TESTING: {
      label: 'Ready for Testing',
      dot: 'bg-teal-500',
      bg: 'bg-teal-500/10 dark:bg-teal-500/15',
      text: 'text-teal-700 dark:text-teal-300 font-medium',
      border: 'border-teal-200 dark:border-teal-500/20'
    },
    TESTING: {
      label: 'Ready for Testing',
      dot: 'bg-teal-500',
      bg: 'bg-teal-500/10 dark:bg-teal-500/15',
      text: 'text-teal-700 dark:text-teal-300 font-medium',
      border: 'border-teal-200 dark:border-teal-500/20'
    },
    VERIFIED: {
      label: 'Verified',
      dot: 'bg-emerald-600',
      bg: 'bg-emerald-500/15 dark:bg-emerald-500/20',
      text: 'text-emerald-800 dark:text-emerald-300 font-bold',
      border: 'border-emerald-300 dark:border-emerald-500/30'
    },
    CLOSED: {
      label: 'Closed',
      dot: 'bg-slate-400',
      bg: 'bg-slate-500/10 dark:bg-slate-500/15',
      text: 'text-slate-700 dark:text-slate-400',
      border: 'border-slate-200 dark:border-slate-500/20'
    },
    REOPENED: {
      label: 'Reopened',
      dot: 'bg-rose-500 animate-ping',
      bg: 'bg-rose-500/15 dark:bg-rose-500/20',
      text: 'text-rose-700 dark:text-rose-300 font-bold',
      border: 'border-rose-300 dark:border-rose-500/30'
    }
  };

  const cfg = configs[status] || configs.REPORTED || configs.NEW;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border ${padding} ${cfg.bg} ${cfg.text} ${cfg.border} transition-colors select-none`}
      title={`Workflow Status: ${cfg.label}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      <span>{cfg.label}</span>
    </span>
  );
};
