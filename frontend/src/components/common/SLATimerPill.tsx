import React from 'react';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface SLATimerPillProps {
  slaBreached: boolean;
  hoursRemaining?: number;
  status: string;
  isStale?: boolean;
}

export const SLATimerPill: React.FC<SLATimerPillProps> = ({
  slaBreached,
  hoursRemaining,
  status,
  isStale
}) => {
  const isResolved = ['RESOLVED', 'VERIFIED', 'CLOSED'].includes(status);

  if (isResolved) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="w-3 h-3" />
        <span>SLA Met</span>
      </span>
    );
  }

  if (slaBreached) {
    const overdueHours = hoursRemaining !== undefined ? Math.abs(hoursRemaining) : 0;
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse"
        title="SLA Breached - Requires Immediate Attention"
      >
        <AlertTriangle className="w-3 h-3 shrink-0" />
        <span>Overdue by {overdueHours > 24 ? `${Math.round(overdueHours / 24)}d` : `${Math.round(overdueHours)}h`}</span>
      </span>
    );
  }

  if (isStale) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
        title="No activity for 30+ days"
      >
        <Clock className="w-3 h-3" />
        <span>Stale Issue</span>
      </span>
    );
  }

  if (hoursRemaining !== undefined && hoursRemaining !== null) {
    const isWarning = hoursRemaining <= 24;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${
          isWarning
            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
            : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
        }`}
        title={`${hoursRemaining} hours remaining before SLA target`}
      >
        <Clock className="w-3 h-3" />
        <span>
          {hoursRemaining > 24 ? `${Math.round(hoursRemaining / 24)}d left` : `${Math.round(hoursRemaining)}h left`}
        </span>
      </span>
    );
  }

  return null;
};
