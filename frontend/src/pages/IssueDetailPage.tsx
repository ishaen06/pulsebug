import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Edit3, Check, X, ShieldAlert, Sparkles, Clock, AlertTriangle,
  GitBranch, GitPullRequest, Paperclip, MessageSquare, History, Plus, Layers,
  Trash2, Link, Bot, UserCheck, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Bug, BugPriority, BugSeverity, BugStatus, User, BugRelation } from '../types';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { StatusBadge } from '../components/common/StatusBadge';
import { SLATimerPill } from '../components/common/SLATimerPill';
import { GitSimulatorCard } from '../components/bugs/GitSimulatorCard';
import { AIInsightsCard } from '../components/bugs/AIInsightsCard';
import { ThreadedComments } from '../components/bugs/ThreadedComments';
import { TimelineAuditView } from '../components/bugs/TimelineAuditView';

interface IssueDetailPageProps {
  bugId: number;
  onBack: () => void;
  onSelectAnotherBug: (bugId: number) => void;
}

export const IssueDetailPage: React.FC<IssueDetailPageProps> = ({ bugId, onBack, onSelectAnotherBug }) => {
  const { user, allUsers, currentProject } = useAuth();
  const [bug, setBug] = useState<Bug | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Edit states
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editSteps, setEditSteps] = useState('');
  const [editExpected, setEditExpected] = useState('');
  const [editActual, setEditActual] = useState('');

  // Add Relation modal
  const [showRelationModal, setShowRelationModal] = useState(false);
  const [targetBugKey, setTargetBugKey] = useState('');
  const [relationType, setRelationType] = useState('BLOCKS');

  // File upload state
  const [isUploading, setIsUploading] = useState(false);

  const fetchBugDetail = async () => {
    try {
      const data = await api.getBug(bugId);
      setBug(data);
      setEditTitle(data.title);
      setEditDesc(data.description);
      setEditSteps(data.steps_to_reproduce || '');
      setEditExpected(data.expected_behavior || '');
      setEditActual(data.actual_behavior || '');
    } catch (err) {
      console.error('Failed to load bug:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBugDetail();
  }, [bugId]);

  const handleStatusChange = async (newStatus: BugStatus) => {
    if (!bug) return;
    try {
      const updated = await api.updateBug(bug.id, { status: newStatus, reason: `Status moved to ${newStatus}` });
      setBug(updated);
    } catch (err: any) {
      alert(`Status transition error: ${err.message}`);
    }
  };

  const handlePriorityChange = async (newPriority: BugPriority) => {
    if (!bug) return;
    try {
      const updated = await api.updateBug(bug.id, { priority: newPriority, reason: `Priority adjusted to ${newPriority}` });
      setBug(updated);
    } catch (err: any) {
      alert(`Priority change error: ${err.message}`);
    }
  };

  const handleAssigneeChange = async (newAssigneeId: number | undefined) => {
    if (!bug) return;
    try {
      const updated = await api.updateBug(bug.id, { assignee_id: newAssigneeId, reason: 'Assignee reassigned' });
      setBug(updated);
    } catch (err: any) {
      alert(`Assignee change error: ${err.message}`);
    }
  };

  const handleSaveTitle = async () => {
    if (!bug || !editTitle.trim()) return;
    try {
      const updated = await api.updateBug(bug.id, { title: editTitle, reason: 'Title updated' });
      setBug(updated);
      setIsEditingTitle(false);
    } catch (err: any) {
      alert(`Update error: ${err.message}`);
    }
  };

  const handleSaveDescriptionAndSteps = async () => {
    if (!bug) return;
    try {
      const updated = await api.updateBug(bug.id, {
        description: editDesc,
        steps_to_reproduce: editSteps,
        expected_behavior: editExpected,
        actual_behavior: editActual,
        reason: 'Issue body and reproduction details updated'
      });
      setBug(updated);
      setIsEditingDesc(false);
    } catch (err: any) {
      alert(`Update error: ${err.message}`);
    }
  };

  const handleAddRelation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bug || !targetBugKey.trim()) return;

    try {
      // Find bug by key or id
      const allBugs = await api.getBugs({ q: targetBugKey.trim() });
      const match = allBugs.find((b) => b.bug_key.toLowerCase() === targetBugKey.trim().toLowerCase());
      if (!match) {
        alert(`Could not find bug with key ${targetBugKey}`);
        return;
      }

      await api.addBugRelation(bug.id, match.id, relationType);
      setShowRelationModal(false);
      setTargetBugKey('');
      fetchBugDetail();
    } catch (err: any) {
      alert(`Failed to add relation: ${err.message}`);
    }
  };

  const handleDeleteRelation = async (relationId: number) => {
    if (!bug) return;
    try {
      await api.deleteBugRelation(bug.id, relationId);
      fetchBugDetail();
    } catch (err: any) {
      alert(`Failed to delete relation: ${err.message}`);
    }
  };

  if (loading || !bug) {
    return (
      <div className="p-12 text-center text-slate-400 text-sm">
        Loading issue details...
      </div>
    );
  }

  const statuses: BugStatus[] = [
    'REPORTED',
    'AI_TRIAGE',
    'IN_DEVELOPMENT',
    'READY_FOR_TESTING',
    'VERIFIED',
    'CLOSED',
    'REOPENED'
  ];

  const isDeveloper = user?.role === 'DEVELOPER';
  const isTester = user?.role === 'TESTER';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Back Button & Breadcrumbs */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Issues</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">Created: {new Date(bug.created_at).toLocaleString()}</span>
        </div>
      </div>

      {/* Stale Warning Banner if > 30 days inactive */}
      {bug.is_stale && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-bold text-amber-900 dark:text-amber-200">
              Stale Issue Detected: No activity recorded for &gt; 30 days. Consider reassigning or closing.
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleStatusChange('CLOSED')}
              className="px-2.5 py-1 rounded bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700 cursor-pointer"
            >
              Close as Stale
            </button>
          </div>
        </div>
      )}

      {/* Role Action Bar (Developer / Tester Permissions) */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-teal-500/10 border border-blue-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded font-bold uppercase text-[10px] bg-blue-600 text-white font-mono">
            {user?.role} Action
          </span>
          <span className="text-slate-700 dark:text-slate-300 font-medium">
            {isDeveloper && "Developer Workflow: Accept tasks, progress code, and deliver to QA testing."}
            {isTester && "Tester Workflow: Verify resolved builds, validate evidence, or flag failed tests."}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Developer Actions */}
          {isDeveloper && ['REPORTED', 'NEW', 'AI_TRIAGE', 'TRIAGED', 'REOPENED'].includes(bug.status) && (
            <button
              onClick={() => handleStatusChange('IN_DEVELOPMENT')}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              Start Development →
            </button>
          )}

          {isDeveloper && bug.status === 'IN_DEVELOPMENT' && (
            <button
              onClick={() => handleStatusChange('READY_FOR_TESTING')}
              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              Mark Ready for Testing →
            </button>
          )}

          {/* Tester Actions */}
          {isTester && ['READY_FOR_TESTING', 'TESTING'].includes(bug.status) && (
            <>
              <button
                onClick={() => handleStatusChange('VERIFIED')}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Pass QA & Verify ✓
              </button>
              <button
                onClick={() => handleStatusChange('REOPENED')}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Test Failed → Reopen ✕
              </button>
            </>
          )}

          {isTester && bug.status === 'VERIFIED' && (
            <>
              <button
                onClick={() => handleStatusChange('CLOSED')}
                className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Close Issue
              </button>
              <button
                onClick={() => handleStatusChange('REOPENED')}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Reopen
              </button>
            </>
          )}
        </div>
      </div>

      {/* Issue Header Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-base font-black px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
              {bug.bug_key}
            </span>
            {/* Status Dropdown */}
            <div className="relative">
              <select
                value={bug.status}
                onChange={(e) => handleStatusChange(e.target.value as BugStatus)}
                className="px-3 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer shadow-xs"
              >
                {statuses.map((st) => (
                  <option key={st} value={st}>{st.replace('_', ' ')}</option>
                ))}
              </select>
            </div>

            {/* Priority Selector */}
            <select
              value={bug.priority}
              onChange={(e) => handlePriorityChange(e.target.value as BugPriority)}
              className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="P1">P1 Critical (24h SLA)</option>
              <option value="P2">P2 High (72h SLA)</option>
              <option value="P3">P3 Medium (7d SLA)</option>
              <option value="P4">P4 Low (14d SLA)</option>
            </select>

            <SeverityBadge severity={bug.severity} size="md" />

            <SLATimerPill
              slaBreached={bug.sla_breached}
              hoursRemaining={bug.sla_hours_remaining}
              status={bug.status}
              isStale={bug.is_stale}
            />
          </div>
        </div>

        {/* Title (Editable) */}
        <div>
          {isEditingTitle ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-blue-500 bg-white dark:bg-slate-800 text-base font-bold text-slate-900 dark:text-white"
                autoFocus
              />
              <button
                onClick={handleSaveTitle}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditingTitle(false)}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs"
              >
                Cancel
              </button>
            </div>
          ) : (
            <h1
              onClick={() => setIsEditingTitle(true)}
              className="text-lg md:text-xl font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer flex items-center gap-2 group"
              title="Click to edit title"
            >
              <span>{bug.title}</span>
              <Edit3 className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h1>
          )}
        </div>
      </div>

      {/* 2-Column Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Main details, AI insights, Git simulator, Comments, Timeline) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Issue Narrative, Reproduction Steps, Expected vs Actual */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Problem Description & Reproduction
              </span>
              <button
                onClick={() => setIsEditingDesc(!isEditingDesc)}
                className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditingDesc ? 'Close Editor' : 'Edit Content'}</span>
              </button>
            </div>

            {isEditingDesc ? (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Description</label>
                  <textarea
                    rows={4}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Reproduction Steps</label>
                  <textarea
                    rows={4}
                    value={editSteps}
                    onChange={(e) => setEditSteps(e.target.value)}
                    className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Expected</label>
                    <textarea
                      rows={2}
                      value={editExpected}
                      onChange={(e) => setEditExpected(e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Actual</label>
                    <textarea
                      rows={2}
                      value={editActual}
                      onChange={(e) => setEditActual(e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
                <button
                  onClick={handleSaveDescriptionAndSteps}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700 cursor-pointer shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-xs text-slate-800 dark:text-slate-200">
                {/* Description Body */}
                <div className="leading-relaxed whitespace-pre-wrap">
                  {bug.description}
                </div>

                {/* Reproduction Steps */}
                {bug.steps_to_reproduce && (
                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="font-bold text-[11px] uppercase tracking-wider text-slate-500">Structured Steps to Reproduce:</div>
                    <div className="font-mono text-xs whitespace-pre-wrap leading-relaxed">
                      {bug.steps_to_reproduce}
                    </div>
                  </div>
                )}

                {/* Expected vs Actual Outcomes */}
                {(bug.expected_behavior || bug.actual_behavior) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {bug.expected_behavior && (
                      <div className="p-3 rounded-lg bg-emerald-50/30 dark:bg-emerald-950/20 border border-emerald-500/20 space-y-1">
                        <div className="font-bold text-emerald-700 dark:text-emerald-400 uppercase text-[10px] tracking-wider flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Expected Outcome</span>
                        </div>
                        <div className="text-slate-700 dark:text-slate-300">{bug.expected_behavior}</div>
                      </div>
                    )}
                    {bug.actual_behavior && (
                      <div className="p-3 rounded-lg bg-rose-50/30 dark:bg-rose-950/20 border border-rose-500/20 space-y-1">
                        <div className="font-bold text-rose-700 dark:text-rose-400 uppercase text-[10px] tracking-wider flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Observed Defect</span>
                        </div>
                        <div className="text-slate-700 dark:text-slate-300">{bug.actual_behavior}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Intelligence & Impact Score Card */}
          <AIInsightsCard bug={bug} onAssignDeveloper={handleAssigneeChange} />

          {/* Git Development Activity & Interactive Simulator */}
          <GitSimulatorCard bug={bug} onGitEventTriggered={fetchBugDetail} />

          {/* Threaded Comments */}
          <ThreadedComments bugId={bug.id} comments={bug.comments || []} onCommentAdded={fetchBugDetail} />

          {/* Chronological Activity Timeline & Immutable Audit Trail */}
          <TimelineAuditView bug={bug} />
        </div>

        {/* Right Column: Metadata, Relations, Attachments */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs text-xs">
            <div className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">
              Metadata & Assignment
            </div>

            <div className="space-y-3">
              {/* Assignee */}
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Assignee</label>
                <select
                  value={bug.assignee_id || ''}
                  onChange={(e) => handleAssigneeChange(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  <option value="">Unassigned</option>
                  {allUsers.filter((u) => u.role === 'DEVELOPER').map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name} (Developer)</option>
                  ))}
                </select>
              </div>

              {/* Component */}
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Component</label>
                <div className="font-semibold text-slate-800 dark:text-slate-200">{bug.component}</div>
              </div>

              {/* Category */}
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Category</label>
                <div className="font-semibold text-slate-800 dark:text-slate-200">{bug.category}</div>
              </div>

              {/* Environment */}
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Target Environment</label>
                <div className="font-semibold text-slate-800 dark:text-slate-200">{bug.environment}</div>
              </div>

              {/* Reporter */}
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Reported By</label>
                <div className="font-semibold text-slate-800 dark:text-slate-200">{bug.reporter?.full_name || 'System'}</div>
              </div>

              {/* Labels */}
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Labels</label>
                <div className="flex flex-wrap gap-1.5">
                  {bug.labels && bug.labels.length > 0 ? (
                    bug.labels.map((l) => (
                      <span key={l} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                        {l}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 italic">No labels</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Issue Relations & Dependency Links */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Issue Dependencies
              </span>
              <button
                onClick={() => setShowRelationModal(true)}
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Link Issue</span>
              </button>
            </div>

            {/* Relations List */}
            <div className="space-y-2">
              {bug.relations && bug.relations.length > 0 ? (
                bug.relations.map((rel: BugRelation) => (
                  <div
                    key={rel.id}
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between gap-2"
                  >
                    <div className="truncate">
                      <span className="font-bold text-[10px] uppercase text-blue-600 dark:text-blue-400 mr-1.5 font-mono">
                        {rel.relation_type.replace('_', ' ')}
                      </span>
                      <button
                        onClick={() => onSelectAnotherBug(rel.target_bug_id)}
                        className="font-mono font-bold text-slate-800 dark:text-slate-200 hover:underline cursor-pointer"
                      >
                        {rel.target_bug_key}
                      </button>
                      <span className="text-slate-400 truncate ml-1.5">{rel.target_bug_title}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteRelation(rel.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                      title="Remove relation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-slate-400 italic py-2">No linked dependencies</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Link Issue Modal */}
      {showRelationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl w-full max-w-md shadow-2xl space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Link className="w-4 h-4 text-blue-500" />
              <span>Link Issue Relationship</span>
            </h3>

            <form onSubmit={handleAddRelation} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Relation Type</label>
                <select
                  value={relationType}
                  onChange={(e) => setRelationType(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                >
                  <option value="BLOCKS">Blocks (This bug blocks target)</option>
                  <option value="BLOCKED_BY">Blocked by (Target blocks this bug)</option>
                  <option value="RELATED_TO">Related to</option>
                  <option value="DUPLICATE_OF">Duplicate of</option>
                  <option value="REGRESSION_OF">Regression of (Historical defect)</option>
                  <option value="PARENT_OF">Parent of</option>
                  <option value="CHILD_OF">Child of</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Target Issue Key</label>
                <input
                  type="text"
                  placeholder="e.g. PAY-102 or NEXUS-201"
                  value={targetBugKey}
                  onChange={(e) => setTargetBugKey(e.target.value)}
                  required
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono uppercase"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRelationModal(false)}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded-lg text-xs hover:bg-blue-700"
                >
                  Create Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
