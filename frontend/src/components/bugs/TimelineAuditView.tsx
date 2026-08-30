import React from 'react';
import { History, GitCommit, GitPullRequest, UserCheck, Sparkles, Shield, ArrowRight, CheckCircle2 } from 'lucide-react';
import { AuditLog, GitIntegration, Bug } from '../../types';

interface TimelineAuditViewProps {
  bug: Bug;
}

export const TimelineAuditView: React.FC<TimelineAuditViewProps> = ({ bug }) => {
  const auditLogs = bug.audit_logs || [];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs">
      <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-3">
        <History className="w-4 h-4 text-blue-500" />
        <span>Chronological Activity Timeline & Immutable Audit Trail</span>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
        {auditLogs.length === 0 ? (
          <div className="text-xs text-slate-400 py-4">No audit events recorded yet.</div>
        ) : (
          auditLogs.map((log) => {
            const isGit = log.action === 'GIT_EVENT';
            const isAI = log.action === 'AI_TRIAGE';
            const isStatus = log.action === 'STATUS_CHANGED';
            const isAssigned = log.action === 'ASSIGNED';
            const isPriority = log.action === 'PRIORITY_CHANGED';

            return (
              <div key={log.id} className="relative group text-xs">
                {/* Timeline Node Dot */}
                <div className={`absolute -left-6 top-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                  isGit ? 'bg-purple-500' :
                  isAI ? 'bg-blue-500' :
                  isStatus ? 'bg-emerald-500' :
                  isPriority ? 'bg-amber-500' : 'bg-slate-400'
                }`} />

                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    {isAI && <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                    {isGit && <GitPullRequest className="w-3.5 h-3.5 text-purple-500 shrink-0" />}
                    {isAssigned && <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                    <span>{log.user_name}</span>
                    <span className="font-normal text-slate-500">({log.action.replace('_', ' ').toLowerCase()})</span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {log.field_name && (log.old_value || log.new_value) && (
                  <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-md border border-slate-100 dark:border-slate-700/50">
                    <span className="text-slate-400">{log.field_name}:</span>
                    {log.old_value && <span className="text-rose-500 line-through">{log.old_value}</span>}
                    {log.old_value && <ArrowRight className="w-3 h-3 text-slate-400" />}
                    <span className="text-emerald-500 font-bold">{log.new_value}</span>
                  </div>
                )}

                {log.reason && (
                  <div className="mt-1 text-slate-500 dark:text-slate-400 italic text-[11px]">
                    "{log.reason}"
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
