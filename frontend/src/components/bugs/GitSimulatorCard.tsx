import React, { useState } from 'react';
import { GitBranch, GitCommit, GitPullRequest, CheckCircle2, Play, ExternalLink, RefreshCw } from 'lucide-react';
import { Bug, GitIntegration } from '../../types';
import { api } from '../../services/api';

interface GitSimulatorCardProps {
  bug: Bug;
  onGitEventTriggered: () => void;
}

export const GitSimulatorCard: React.FC<GitSimulatorCardProps> = ({ bug, onGitEventTriggered }) => {
  const [loadingEvent, setLoadingEvent] = useState<string | null>(null);

  const gitItems = bug.git_integrations || [];

  const handleSimulate = async (eventType: string) => {
    setLoadingEvent(eventType);
    try {
      await api.simulateGitEvent(bug.id, eventType);
      onGitEventTriggered();
    } catch (err) {
      console.error('Git simulation error:', err);
    } finally {
      setLoadingEvent(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
      {/* Card Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
        <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
          <GitPullRequest className="w-4 h-4 text-purple-500" />
          <span>GitHub & Development Activity</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono font-semibold border border-purple-500/20">
          Auto-Workflow
        </span>
      </div>

      {/* Interactive Simulation Toolbar */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-purple-50/20 dark:bg-purple-950/10">
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
          <Play className="w-3.5 h-3.5 text-purple-500" />
          <span>Simulate GitHub Lifecycle (Interactive Automation Demo):</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleSimulate('branch_created')}
            disabled={loadingEvent !== null}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-purple-400 hover:text-purple-600 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            <GitBranch className="w-3.5 h-3.5 text-blue-500" />
            <span>Create Branch (→ IN_DEV)</span>
          </button>

          <button
            onClick={() => handleSimulate('pr_opened')}
            disabled={loadingEvent !== null}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-purple-400 hover:text-purple-600 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            <GitPullRequest className="w-3.5 h-3.5 text-cyan-500" />
            <span>Open PR (→ CODE_REVIEW)</span>
          </button>

          <button
            onClick={() => handleSimulate('pr_merged')}
            disabled={loadingEvent !== null}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 shadow-sm shadow-purple-500/20 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {loadingEvent === 'pr_merged' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>Merge PR (→ QA TESTING)</span>
          </button>

          <button
            onClick={() => handleSimulate('release_tagged')}
            disabled={loadingEvent !== null}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Deploy Release (→ VERIFIED)</span>
          </button>
        </div>
      </div>

      {/* Linked Git Integrations List */}
      <div className="p-4 space-y-3">
        {gitItems.length === 0 ? (
          <div className="text-center py-4 text-xs text-slate-400">
            No linked Git branches or PRs yet. Use the simulator above or connect via GitHub webhook.
          </div>
        ) : (
          gitItems.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-start justify-between text-xs gap-3"
            >
              <div className="space-y-1 truncate">
                {item.pr_number ? (
                  <div className="flex items-center gap-2">
                    <GitPullRequest className="w-4 h-4 text-purple-500 shrink-0" />
                    <span className="font-bold text-slate-900 dark:text-slate-100">PR #{item.pr_number}: {item.pr_title}</span>
                    <span className={`px-2 py-0.2 rounded-full font-bold text-[10px] ${
                      item.pr_status === 'MERGED' ? 'bg-purple-500/15 text-purple-600' :
                      item.pr_status === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-blue-500/15 text-blue-600'
                    }`}>
                      {item.pr_status}
                    </span>
                  </div>
                ) : item.branch_name ? (
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{item.branch_name}</span>
                  </div>
                ) : null}

                {item.commit_sha && (
                  <div className="flex items-center gap-2 text-slate-500">
                    <GitCommit className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-mono text-xs">{item.commit_sha}</span>
                    <span>•</span>
                    <span className="truncate">{item.commit_message}</span>
                  </div>
                )}

                {item.release_tag && (
                  <div className="text-emerald-600 dark:text-emerald-400 font-bold">
                    Deployed in Release Tag: <span className="font-mono">{item.release_tag}</span>
                  </div>
                )}
              </div>

              <div className="text-[10px] text-slate-400 text-right shrink-0">
                <div>{item.author}</div>
                <div>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
