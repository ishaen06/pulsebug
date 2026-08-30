import React, { useState, useEffect, useMemo } from 'react';
import { Search, Sparkles, Activity, Moon, Sun, UserCheck, X, Zap, Bot, ArrowRight, CornerDownLeft, Filter, Tag, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Bug, AINLSearchResponse } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { PriorityBadge } from './PriorityBadge';
import { StatusBadge } from './StatusBadge';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  bugs: Bug[];
  onSelectBug: (bug: Bug) => void;
  onOpenCreate: () => void;
  onNavigate: (view: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  bugs,
  onSelectBug,
  onOpenCreate,
  onNavigate
}) => {
  const [query, setQuery] = useState('');
  const [nlResult, setNlResult] = useState<AINLSearchResponse | null>(null);
  const [isSearchingAI, setIsSearchingAI] = useState(false);
  const { allUsers, switchUser, user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // AI Agent Natural Language query analysis with debounce
  useEffect(() => {
    if (!query.trim() || query.length < 3) {
      setNlResult(null);
      setIsSearchingAI(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingAI(true);
      try {
        const res = await api.aiNLSearch(query);
        setNlResult(res);
      } catch (err) {
        // fallback silent
      } finally {
        setIsSearchingAI(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Intelligent Multi-Word & AI Filtered Bugs Calculation
  const filteredBugs = useMemo(() => {
    if (!query.trim()) return bugs.slice(0, 5);

    const qLower = query.toLowerCase();
    const tokens = qLower.split(/\s+/).filter(t => t.length > 1);

    return bugs.filter((b) => {
      // 1. If AI parsed specific filters, apply them
      if (nlResult?.parsed_filters) {
        const f = nlResult.parsed_filters;
        if (f.priority && b.priority !== f.priority) return false;
        if (f.severity && b.severity !== f.severity) return false;
        if (f.status && b.status !== f.status) return false;
        if (f.status_not_in && f.status_not_in.includes(b.status)) return false;
        if (f.sla_breached && !b.sla_breached) return false;
        if (f.min_overdue_days && b.sla_due_date) {
          const dueDate = new Date(b.sla_due_date).getTime();
          const now = Date.now();
          const overdueDays = (now - dueDate) / (1000 * 60 * 60 * 24);
          if (overdueDays < f.min_overdue_days) return false;
        }
        if (f.min_overdue_hours && b.sla_due_date) {
          const dueDate = new Date(b.sla_due_date).getTime();
          const now = Date.now();
          const overdueHours = (now - dueDate) / (1000 * 60 * 60);
          if (overdueHours < f.min_overdue_hours) return false;
        }
        if (f.is_stale && !b.is_stale) return false;
        if (f.is_security_sensitive && !b.is_security_sensitive) return false;
        if (f.high_impact && b.impact_score < 80) return false;
        if (f.category && !b.category.toLowerCase().includes(f.category.toLowerCase())) return false;
        if (f.component && !b.component.toLowerCase().includes(f.component.toLowerCase())) return false;
        if (f.assignee_name && (!b.assignee || !b.assignee.full_name.toLowerCase().includes(f.assignee_name.toLowerCase()))) return false;
        if (f.assignee_me && user && b.assignee_id !== user.id) return false;
        if (f.is_unassigned && b.assignee_id) return false;
      }

      // 2. Keyword tokens matching across title, key, component, description, and labels
      const searchTarget = `${b.bug_key} ${b.title} ${b.component} ${b.category} ${b.description || ''} ${b.labels?.join(' ') || ''}`.toLowerCase();
      
      const keywordsToMatch = nlResult?.extracted_keywords && nlResult.extracted_keywords.length > 0
        ? nlResult.extracted_keywords
        : tokens;

      return keywordsToMatch.every(tok => searchTarget.includes(tok));
    }).slice(0, 8);
  }, [bugs, query, nlResult, user]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Search Bar Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 gap-3 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="relative flex items-center justify-center">
            <Search className={`w-5 h-5 ${isSearchingAI ? 'text-purple-500 animate-pulse' : 'text-blue-500'} shrink-0`} />
            {isSearchingAI && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-500 animate-ping" />
            )}
          </div>
          <input
            type="text"
            placeholder="Ask AI Copilot (e.g. 'critical auth bugs in payments assigned to rahul' or 'overdue SLAs')..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none text-sm sm:text-base font-medium"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setNlResult(null); }}
              className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold tracking-wider font-mono shrink-0">
            AI AGENT
          </span>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-3 space-y-4">
          {/* AI Agent Interpretation Banner */}
          {nlResult && (
            <div className="p-3.5 rounded-lg bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 border border-purple-500/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-700 dark:text-purple-300">
                  <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>AI Copilot Analysis ({Math.round((nlResult.confidence_score || 0.9) * 100)}% confidence)</span>
                </div>
                <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-semibold">
                  {filteredBugs.length} Matches Found
                </span>
              </div>

              <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                {nlResult.ai_agent_summary || nlResult.interpreted_intent}
              </div>

              {/* Active Filter Chips */}
              {nlResult.active_filter_chips && nlResult.active_filter_chips.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {nlResult.active_filter_chips.map((chip, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-700 dark:text-purple-300 text-[11px] font-semibold border border-purple-500/20 flex items-center gap-1"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      <span>{chip}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Smart Follow-Up Suggestions */}
              {nlResult.suggested_followups && nlResult.suggested_followups.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-purple-500/15">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Suggestions:</span>
                  {nlResult.suggested_followups.map((sug, i) => (
                    <button
                      key={i}
                      onClick={() => setQuery(sug)}
                      className="px-2 py-0.5 rounded-full bg-white/80 dark:bg-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-600 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick Actions (when query is empty) */}
          {!query && (
            <div>
              <div className="px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">AI Copilot Quick Prompts</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1">
                <button
                  onClick={() => setQuery('critical p1 bugs in payments')}
                  className="flex items-center gap-2 p-2 rounded-lg text-xs text-left bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span className="truncate font-medium">Critical P1 bugs in payments</span>
                </button>
                <button
                  onClick={() => setQuery('overdue SLA bugs ready for testing')}
                  className="flex items-center gap-2 p-2 rounded-lg text-xs text-left bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate font-medium">Overdue SLA bugs ready for QA</span>
                </button>
                <button
                  onClick={() => setQuery('authentication session timeout errors')}
                  className="flex items-center gap-2 p-2 rounded-lg text-xs text-left bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span className="truncate font-medium">Auth session timeout errors</span>
                </button>
                <button
                  onClick={() => setQuery('bugs assigned to rahul')}
                  className="flex items-center gap-2 p-2 rounded-lg text-xs text-left bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="truncate font-medium">Bugs assigned to Rahul</span>
                </button>
              </div>

              <div className="px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider mt-4">System Actions</div>
              <div className="space-y-0.5 mt-1">
                <button
                  onClick={() => { onOpenCreate(); onClose(); }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-colors text-left cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <span>Report New Defect with AI Triage</span>
                </button>
                <button
                  onClick={() => { onNavigate('analytics'); onClose(); }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                >
                  <Activity className="w-4 h-4 text-emerald-500" />
                  <span>View Project Health & Velocity Analytics</span>
                </button>
                <button
                  onClick={() => { toggleTheme(); onClose(); }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
                  <span>Toggle {theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
                </button>
              </div>
            </div>
          )}

          {/* Matching Bugs Results */}
          {filteredBugs.length > 0 ? (
            <div>
              <div className="px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Matching Issues ({filteredBugs.length})</span>
                <span className="text-[10px] text-slate-400 font-mono">Press to open</span>
              </div>
              <div className="space-y-1.5 mt-1">
                {filteredBugs.map((bug) => (
                  <button
                    key={bug.id}
                    onClick={() => { onSelectBug(bug); onClose(); }}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-800/40 hover:bg-blue-50/70 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-500/30 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0">
                        {bug.bug_key}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {bug.title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate flex items-center gap-2 mt-0.5">
                          <span>{bug.component}</span>
                          <span>•</span>
                          <span>{bug.assignee?.full_name || 'Unassigned'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <PriorityBadge priority={bug.priority} size="sm" />
                      <StatusBadge status={bug.status} size="sm" />
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 group-hover:text-blue-500 transition-all" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : query ? (
            <div className="p-8 text-center text-xs text-slate-400 space-y-2">
              <Bot className="w-8 h-8 mx-auto text-slate-400/60" />
              <div className="font-semibold text-slate-600 dark:text-slate-300">No issues matching your AI query</div>
              <p className="text-[11px]">Try adjusting keywords or selecting one of the suggested prompts above.</p>
            </div>
          ) : null}

          {/* Quick Role Switcher */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">Switch Persona (Demo Evaluation)</div>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {allUsers.slice(0, 4).map((u) => (
                <button
                  key={u.id}
                  onClick={() => { switchUser(u.email); onClose(); }}
                  className="flex items-center gap-2 p-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-800 transition-colors text-left cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="truncate font-medium text-slate-700 dark:text-slate-200">{u.full_name} ({u.role})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1"><Bot className="w-3 h-3 text-purple-500" /> Natural Language AI Parser Active</span>
          </div>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};
