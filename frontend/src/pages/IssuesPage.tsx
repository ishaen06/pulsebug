import React, { useState, useEffect } from 'react';
import {
  Search, Filter, SlidersHorizontal, Plus, Sparkles, Clock, AlertTriangle,
  Flame, CheckCircle2, ChevronRight, Layers, Table, KanbanSquare, ArrowUpDown, X,
  ArrowRight, Check, RotateCcw, AlertCircle, GripVertical, Bot, Tag, Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { api } from '../services/api';
import { Bug, BugPriority, BugSeverity, BugStatus } from '../types';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { StatusBadge } from '../components/common/StatusBadge';
import { SLATimerPill } from '../components/common/SLATimerPill';

interface IssuesPageProps {
  onSelectBug: (bug: Bug) => void;
  onOpenCreate: () => void;
  initialFilter?: string;
  initialViewMode?: 'table' | 'kanban';
}

interface KanbanColumnConfig {
  id: BugStatus;
  label: string;
  sublabel: string;
  matchStatuses: BugStatus[];
  borderColor: string;
  headerBg: string;
  accentDot: string;
}

export const IssuesPage: React.FC<IssuesPageProps> = ({
  onSelectBug,
  onOpenCreate,
  initialFilter,
  initialViewMode = 'table'
}) => {
  const { currentProject, user, allUsers } = useAuth();

  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>(initialViewMode);
  const [draggedBugId, setDraggedBugId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<BugStatus | null>(null);
  const [transitionMessage, setTransitionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search & NL Search
  const [searchQuery, setSearchQuery] = useState('');
  const [isNLSearching, setIsNLSearching] = useState(false);
  const [nlChips, setNlChips] = useState<string[]>([]);
  const [aiAgentSummary, setAiAgentSummary] = useState<string | null>(null);
  const [aiFollowups, setAiFollowups] = useState<string[]>([]);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>(initialFilter === 'open' ? 'OPEN' : '');
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('');
  const [selectedComponent, setSelectedComponent] = useState<string>('');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');
  const [filterOverdue, setFilterOverdue] = useState<boolean>(false);
  const [minOverdueDays, setMinOverdueDays] = useState<number | null>(null);
  const [minOverdueHours, setMinOverdueHours] = useState<number | null>(null);
  const [filterStale, setFilterStale] = useState<boolean>(false);

  // Sync viewMode when initialViewMode changes (e.g. from Sidebar navigation)
  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode]);

  const fetchBugs = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        project_id: currentProject?.id,
        status: selectedStatus || undefined,
        priority: selectedPriority || undefined,
        severity: selectedSeverity || undefined,
        component: selectedComponent || undefined,
        assignee_id: selectedAssignee ? Number(selectedAssignee) : undefined,
        sla_breached: filterOverdue ? true : undefined,
        min_overdue_days: minOverdueDays || undefined,
        min_overdue_hours: minOverdueHours || undefined,
        is_stale: filterStale ? true : undefined,
        q: searchQuery.trim() || undefined
      };
      const data = await api.getBugs(params);
      setBugs(data);
    } catch (err) {
      console.error('Failed to fetch bugs:', err);
    } finally {
      setLoading(false);
    }
  };

  const { lastEvent } = useWebSocket();

  useEffect(() => {
    fetchBugs();
  }, [currentProject, selectedStatus, selectedPriority, selectedSeverity, selectedComponent, selectedAssignee, filterOverdue, minOverdueDays, minOverdueHours, filterStale]);

  useEffect(() => {
    if (lastEvent) {
      fetchBugs();
    }
  }, [lastEvent]);

  // Handle Natural Language Search Enter with AI Agent Synthesis
  const handleNLSearch = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const qToUse = customQuery !== undefined ? customQuery : searchQuery;
    if (!qToUse.trim()) {
      handleClearFilters();
      return;
    }

    setIsNLSearching(true);
    try {
      const nlRes = await api.aiNLSearch(qToUse);
      setNlChips(nlRes.active_filter_chips || []);
      setAiAgentSummary(nlRes.ai_agent_summary || nlRes.interpreted_intent);
      setAiFollowups(nlRes.suggested_followups || []);

      const filters = nlRes.parsed_filters;
      if (filters.priority) setSelectedPriority(filters.priority);
      if (filters.severity) setSelectedSeverity(filters.severity);
      if (filters.status) setSelectedStatus(filters.status);
      if (filters.status_not_in) setSelectedStatus('OPEN');
      if (filters.category) setSelectedComponent(filters.category);
      if (filters.sla_breached) setFilterOverdue(true);
      if (filters.min_overdue_days) {
        setMinOverdueDays(filters.min_overdue_days);
        setFilterOverdue(true);
      } else {
        setMinOverdueDays(null);
      }
      if (filters.min_overdue_hours) {
        setMinOverdueHours(filters.min_overdue_hours);
        setFilterOverdue(true);
      } else {
        setMinOverdueHours(null);
      }
      if (filters.is_stale) setFilterStale(true);
      if (filters.assignee_me && user) setSelectedAssignee(String(user.id));
      if (filters.assignee_name) {
        const match = allUsers.find(u => u.full_name.toLowerCase().includes(filters.assignee_name.toLowerCase()));
        if (match) setSelectedAssignee(String(match.id));
      }

      if (customQuery !== undefined) {
        setSearchQuery(customQuery);
      }
    } catch (err) {
      console.error('NL Search error:', err);
    } finally {
      setIsNLSearching(false);
    }
  };

  const handleClearFilters = () => {
    setSelectedStatus('');
    setSelectedPriority('');
    setSelectedSeverity('');
    setSelectedComponent('');
    setSelectedAssignee('');
    setFilterOverdue(false);
    setMinOverdueDays(null);
    setMinOverdueHours(null);
    setFilterStale(false);
    setSearchQuery('');
    setNlChips([]);
    setAiAgentSummary(null);
    setAiFollowups([]);
  };

  // Quick Status Transition Handler
  const handleQuickStatusChange = async (bugId: number, targetStatus: BugStatus, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.updateBug(bugId, { status: targetStatus });
      setTransitionMessage({
        type: 'success',
        text: `Successfully moved to ${targetStatus.replace(/_/g, ' ')}`
      });
      setTimeout(() => setTransitionMessage(null), 3000);
      fetchBugs();
    } catch (err: any) {
      setTransitionMessage({
        type: 'error',
        text: err?.response?.data?.detail || err.message || 'Transition disallowed for your role.'
      });
      setTimeout(() => setTransitionMessage(null), 4000);
    }
  };

  // HTML5 Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, bugId: number) => {
    setDraggedBugId(bugId);
    e.dataTransfer.setData('text/plain', String(bugId));
  };

  const handleDragOver = (e: React.DragEvent, columnId: BugStatus) => {
    e.preventDefault();
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: BugStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const bugIdStr = e.dataTransfer.getData('text/plain');
    const bugId = Number(bugIdStr) || draggedBugId;
    if (!bugId) return;

    await handleQuickStatusChange(bugId, targetStatus);
    setDraggedBugId(null);
  };

  // Normalized Kanban Columns matching Developer & Tester 2-Role workflow
  const kanbanColumns: KanbanColumnConfig[] = [
    {
      id: 'REPORTED',
      label: 'Reported',
      sublabel: 'New & Unassigned Defects',
      matchStatuses: ['REPORTED', 'NEW'],
      borderColor: 'border-blue-500/30',
      headerBg: 'bg-blue-500/10 dark:bg-blue-500/15',
      accentDot: 'bg-blue-500'
    },
    {
      id: 'AI_TRIAGE',
      label: 'AI Triage',
      sublabel: 'Auto-Classified & Scored',
      matchStatuses: ['AI_TRIAGE', 'TRIAGED'],
      borderColor: 'border-purple-500/30',
      headerBg: 'bg-purple-500/10 dark:bg-purple-500/15',
      accentDot: 'bg-purple-500'
    },
    {
      id: 'IN_DEVELOPMENT',
      label: 'In Development',
      sublabel: 'Developer Active Coding / Branch',
      matchStatuses: ['IN_DEVELOPMENT', 'ASSIGNED', 'CODE_REVIEW'],
      borderColor: 'border-amber-500/30',
      headerBg: 'bg-amber-500/10 dark:bg-amber-500/15',
      accentDot: 'bg-amber-500'
    },
    {
      id: 'READY_FOR_TESTING',
      label: 'Ready for Testing',
      sublabel: 'Awaiting QA Verification',
      matchStatuses: ['READY_FOR_TESTING', 'TESTING'],
      borderColor: 'border-teal-500/30',
      headerBg: 'bg-teal-500/10 dark:bg-teal-500/15',
      accentDot: 'bg-teal-500'
    },
    {
      id: 'VERIFIED',
      label: 'Verified',
      sublabel: 'QA Test Passed & Validated',
      matchStatuses: ['VERIFIED', 'RESOLVED'],
      borderColor: 'border-emerald-500/30',
      headerBg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
      accentDot: 'bg-emerald-500'
    },
    {
      id: 'CLOSED',
      label: 'Closed',
      sublabel: 'Shipped to Production',
      matchStatuses: ['CLOSED'],
      borderColor: 'border-slate-500/30',
      headerBg: 'bg-slate-500/10 dark:bg-slate-500/15',
      accentDot: 'bg-slate-400'
    },
    {
      id: 'REOPENED',
      label: 'Reopened',
      sublabel: 'QA Test Failed → Fix Required',
      matchStatuses: ['REOPENED'],
      borderColor: 'border-rose-500/30',
      headerBg: 'bg-rose-500/10 dark:bg-rose-500/15',
      accentDot: 'bg-rose-500'
    }
  ];

  const isDeveloper = user?.role === 'DEVELOPER';
  const isTester = user?.role === 'TESTER';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <span>{viewMode === 'kanban' ? 'Kanban Workflow Board' : 'Issue Triage & Lifecycle'}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-semibold">
              {bugs.length} Issues
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {viewMode === 'kanban'
              ? 'Interactive drag-and-drop workflow stages tailored for Developers & Testers'
              : 'Deconstructed developer issue tracking with live AI triage, duplicate detection, and SLA monitors'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenCreate}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Issue</span>
          </button>
        </div>
      </div>

      {/* Transition Feedback Toast */}
      {transitionMessage && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200 ${
            transitionMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          {transitionMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          )}
          <span>{transitionMessage.text}</span>
        </div>
      )}

      {/* PulseBug AI Copilot Search & Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs space-y-3.5">
        {/* Copilot Header Badge & Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent uppercase tracking-wider">
                PulseBug AI Copilot
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
              <span>Natural Language NLP Active</span>
            </span>
          </div>

          <form onSubmit={(e) => handleNLSearch(e)} className="flex gap-2">
            <div className="relative flex-1">
              <Bot className={`w-4 h-4 absolute left-3.5 top-3 ${isNLSearching ? 'text-purple-500 animate-spin' : 'text-purple-600 dark:text-purple-400'}`} />
              <input
                type="text"
                placeholder='Ask Copilot: "Show critical auth bugs assigned to rahul", "Which bugs missed SLA?", or "Ready for QA"...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-28 py-2.5 rounded-lg border border-purple-200/60 dark:border-purple-900/40 bg-purple-50/20 dark:bg-purple-950/20 text-xs text-slate-900 dark:text-slate-100 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-medium placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="absolute right-24 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="submit"
                disabled={isNLSearching}
                className="absolute right-2 top-1.5 px-3.5 py-1.5 rounded-md bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold text-[11px] shadow-sm shadow-purple-500/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-3 h-3" />
                <span>{isNLSearching ? 'Analyzing...' : 'Ask Copilot'}</span>
              </button>
            </div>
          </form>

          {/* Quick Pre-Built Copilot Prompts */}
          {!searchQuery && !aiAgentSummary && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-purple-500" /> Prompts:
              </span>
              <button
                type="button"
                onClick={() => handleNLSearch(undefined, 'critical P1 payment defects')}
                className="px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                🚨 Critical P1 payment bugs
              </button>
              <button
                type="button"
                onClick={() => handleNLSearch(undefined, 'overdue SLA breaches')}
                className="px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                🔥 Overdue SLA breaches
              </button>
              <button
                type="button"
                onClick={() => handleNLSearch(undefined, 'ready for testing')}
                className="px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                🧪 Ready for QA testing
              </button>
              <button
                type="button"
                onClick={() => handleNLSearch(undefined, 'bugs assigned to rahul')}
                className="px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                👤 Assigned to Rahul
              </button>
              <button
                type="button"
                onClick={() => handleNLSearch(undefined, 'high impact score')}
                className="px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                ⚡ High Impact (≥80)
              </button>
            </div>
          )}
        </div>

        {/* AI Copilot Agent Analysis Card */}
        {aiAgentSummary && (
          <div className="p-3.5 rounded-lg bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 border border-purple-500/25 space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-700 dark:text-purple-300">
                <Bot className="w-4 h-4 text-purple-500" />
                <span>AI Copilot Analysis & Diagnostics</span>
              </div>
              <button
                onClick={handleClearFilters}
                className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
              >
                Reset Filter
              </button>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
              {aiAgentSummary}
            </p>

            {/* Active Filter Chips */}
            {nlChips.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {nlChips.map((chip, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-[11px] font-semibold"
                  >
                    <Tag className="w-2.5 h-2.5" />
                    <span>{chip}</span>
                  </span>
                ))}
              </div>
            )}

            {/* AI Suggested Follow-up Queries */}
            {aiFollowups.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-purple-500/15">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Copilot Suggestions:</span>
                {aiFollowups.map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => handleNLSearch(undefined, sug)}
                    className="px-2 py-0.5 rounded-md bg-white/90 dark:bg-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 hover:text-purple-600 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    + {sug}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Structured Filter Selectors */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">All Open Issues</option>
            <option value="REPORTED">Reported</option>
            <option value="AI_TRIAGE">AI Triage</option>
            <option value="IN_DEVELOPMENT">In Development</option>
            <option value="READY_FOR_TESTING">Ready for Testing</option>
            <option value="VERIFIED">Verified</option>
            <option value="CLOSED">Closed</option>
            <option value="REOPENED">Reopened</option>
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200"
          >
            <option value="">All Priorities</option>
            <option value="P1">P1 Critical (24h SLA)</option>
            <option value="P2">P2 High (72h SLA)</option>
            <option value="P3">P3 Medium (7d SLA)</option>
            <option value="P4">P4 Low (14d SLA)</option>
          </select>

          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={selectedComponent}
            onChange={(e) => setSelectedComponent(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 max-w-xs"
          >
            <option value="">All Components</option>
            {currentProject?.components.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={selectedAssignee}
            onChange={(e) => setSelectedAssignee(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200"
          >
            <option value="">All Assignees</option>
            {allUsers.filter((u) => u.role === 'DEVELOPER').map((u) => (
              <option key={u.id} value={u.id}>{u.full_name} (Developer)</option>
            ))}
          </select>

          {/* Quick SLA Overdue Filter Toggle */}
          <button
            onClick={() => setFilterOverdue(!filterOverdue)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
              filterOverdue
                ? 'bg-rose-500 text-white border-rose-600'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Overdue SLA</span>
          </button>

          {/* Quick Stale Filter Toggle */}
          <button
            onClick={() => setFilterStale(!filterStale)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
              filterStale
                ? 'bg-amber-500 text-white border-amber-600'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Stale (&gt;30d)</span>
          </button>

          {(selectedStatus || selectedPriority || selectedSeverity || selectedComponent || selectedAssignee || filterOverdue || filterStale || searchQuery) && (
            <button
              onClick={handleClearFilters}
              className="px-2 py-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-semibold flex items-center gap-1 ml-auto"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">
          Loading issues and triage metadata...
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE / LIST VIEW */
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Key</th>
                  <th className="py-3 px-4">Title & Component</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">SLA Countdown</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {bugs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                      No issues matched the active filters.
                    </td>
                  </tr>
                ) : (
                  bugs.map((bug) => (
                    <tr
                      key={bug.id}
                      onClick={() => onSelectBug(bug)}
                      className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 cursor-pointer transition-colors group"
                    >
                      {/* Key */}
                      <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {bug.bug_key}
                      </td>

                      {/* Title & Component */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors line-clamp-1">
                          {bug.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                          <span>{bug.component}</span>
                          {bug.is_security_sensitive && (
                            <span className="text-[10px] px-1 rounded bg-rose-500/10 text-rose-600 font-bold border border-rose-500/20">
                              SECURITY
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge status={bug.status} />
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <PriorityBadge priority={bug.priority} />
                      </td>

                      {/* Severity */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <SeverityBadge severity={bug.severity} />
                      </td>

                      {/* SLA Countdown */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <SLATimerPill
                          slaBreached={bug.sla_breached}
                          hoursRemaining={bug.sla_hours_remaining}
                          status={bug.status}
                          isStale={bug.is_stale}
                        />
                      </td>

                      {/* Assignee */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {bug.assignee ? (
                          <div className="flex items-center gap-2">
                            {bug.assignee.avatar_url ? (
                              <img src={bug.assignee.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">
                                {bug.assignee.full_name.charAt(0)}
                              </div>
                            )}
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{bug.assignee.full_name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-[11px] font-mono">
                        {new Date(bug.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* INTERACTIVE DRAG-AND-DROP KANBAN BOARD VIEW */
        <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
          {kanbanColumns.map((col) => {
            const colBugs = bugs.filter((b) => col.matchStatuses.includes(b.status));
            const isHovered = dragOverColumn === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`w-80 shrink-0 rounded-xl border transition-all flex flex-col max-h-[78vh] ${
                  isHovered
                    ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 shadow-lg'
                    : `border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40`
                }`}
              >
                {/* Column Header */}
                <div className={`p-3.5 rounded-t-xl border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between ${col.headerBg}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.accentDot}`} />
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{col.label}</span>
                        <span className="text-[11px] font-mono px-2 py-0.2 rounded-md bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                          {colBugs.length}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{col.sublabel}</div>
                    </div>
                  </div>
                </div>

                {/* Column Card List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {colBugs.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                      No issues in this stage
                    </div>
                  ) : (
                    colBugs.map((bug) => (
                      <div
                        key={bug.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, bug.id)}
                        onClick={() => onSelectBug(bug)}
                        className={`p-3.5 rounded-lg border bg-white dark:bg-slate-900 hover:border-blue-500 dark:hover:border-blue-500 shadow-xs cursor-pointer transition-all space-y-2.5 group relative ${
                          draggedBugId === bug.id ? 'opacity-40 scale-95 border-dashed border-blue-400' : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        {/* Top: Bug Key & Priority */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <GripVertical className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                              {bug.bug_key}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <PriorityBadge priority={bug.priority} size="sm" />
                          </div>
                        </div>

                        {/* Title */}
                        <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 group-hover:text-blue-600 line-clamp-2 leading-relaxed">
                          {bug.title}
                        </div>

                        {/* Badges: Severity + SLA Countdown */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <SeverityBadge severity={bug.severity} size="sm" />
                          <SLATimerPill
                            slaBreached={bug.sla_breached}
                            hoursRemaining={bug.sla_hours_remaining}
                            status={bug.status}
                            isStale={bug.is_stale}
                          />
                        </div>

                        {/* Component & Assignee */}
                        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 dark:border-slate-800/80 text-slate-500">
                          <span className="truncate max-w-[120px] font-medium text-slate-600 dark:text-slate-400">
                            {bug.component}
                          </span>

                          {bug.assignee ? (
                            <div className="flex items-center gap-1.5">
                              {bug.assignee.avatar_url ? (
                                <img src={bug.assignee.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                              ) : (
                                <div className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[9px] font-bold">
                                  {bug.assignee.full_name.charAt(0)}
                                </div>
                              )}
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {bug.assignee.full_name.split(' ')[0]}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[10px]">Unassigned</span>
                          )}
                        </div>

                        {/* Quick Role Actions */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {/* Developer quick action */}
                          {isDeveloper && ['REPORTED', 'NEW', 'AI_TRIAGE', 'TRIAGED', 'REOPENED'].includes(bug.status) && (
                            <button
                              onClick={(e) => handleQuickStatusChange(bug.id, 'IN_DEVELOPMENT', e)}
                              className="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500 text-amber-700 hover:text-white dark:text-amber-300 font-bold text-[10px] transition-colors flex items-center gap-1 cursor-pointer"
                              title="Accept & Start Coding"
                            >
                              <span>Start Dev</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          )}

                          {isDeveloper && ['IN_DEVELOPMENT', 'ASSIGNED', 'CODE_REVIEW'].includes(bug.status) && (
                            <button
                              onClick={(e) => handleQuickStatusChange(bug.id, 'READY_FOR_TESTING', e)}
                              className="px-2 py-0.5 rounded bg-teal-500/15 hover:bg-teal-500 text-teal-700 hover:text-white dark:text-teal-300 font-bold text-[10px] transition-colors flex items-center gap-1 cursor-pointer"
                              title="Mark Ready for QA Testing"
                            >
                              <span>Ready for QA</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          )}

                          {/* Tester quick actions */}
                          {isTester && ['READY_FOR_TESTING', 'TESTING'].includes(bug.status) && (
                            <div className="flex gap-1">
                              <button
                                onClick={(e) => handleQuickStatusChange(bug.id, 'VERIFIED', e)}
                                className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500 text-emerald-700 hover:text-white dark:text-emerald-300 font-bold text-[10px] transition-colors flex items-center gap-0.5 cursor-pointer"
                                title="Pass QA Verification"
                              >
                                <Check className="w-2.5 h-2.5" />
                                <span>Verify</span>
                              </button>
                              <button
                                onClick={(e) => handleQuickStatusChange(bug.id, 'REOPENED', e)}
                                className="px-2 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500 text-rose-700 hover:text-white dark:text-rose-300 font-bold text-[10px] transition-colors flex items-center gap-0.5 cursor-pointer"
                                title="Fail QA and Reopen"
                              >
                                <RotateCcw className="w-2.5 h-2.5" />
                                <span>Fail</span>
                              </button>
                            </div>
                          )}

                          {isTester && ['VERIFIED', 'RESOLVED'].includes(bug.status) && (
                            <button
                              onClick={(e) => handleQuickStatusChange(bug.id, 'CLOSED', e)}
                              className="px-2 py-0.5 rounded bg-slate-500/15 hover:bg-slate-700 text-slate-700 hover:text-white dark:text-slate-300 font-bold text-[10px] transition-colors flex items-center gap-0.5 cursor-pointer"
                              title="Close Defect"
                            >
                              <Check className="w-2.5 h-2.5" />
                              <span>Close</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
