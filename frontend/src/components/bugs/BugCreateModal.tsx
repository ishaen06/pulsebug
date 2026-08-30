import React, { useState, useEffect } from 'react';
import {
  X, Sparkles, Check, AlertTriangle, ArrowRight, ShieldAlert,
  Bot, RefreshCw, Copy, CheckCircle2, FileText, ChevronRight, Layers
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  BugSeverity, BugPriority, AITriageResponse, AIDuplicateCheckResponse,
  AIQualityScoreResponse, AIReproductionStepsResponse, DuplicateCandidate
} from '../../types';
import { PriorityBadge } from '../common/PriorityBadge';
import { SeverityBadge } from '../common/SeverityBadge';

interface BugCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBugCreated: () => void;
}

export const BugCreateModal: React.FC<BugCreateModalProps> = ({ isOpen, onClose, onBugCreated }) => {
  const { currentProject, allUsers, user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [category, setCategory] = useState('General');
  const [component, setComponent] = useState('Core');
  const [severity, setSeverity] = useState<BugSeverity>('MEDIUM');
  const [priority, setPriority] = useState<BugPriority>('P3');
  const [environment, setEnvironment] = useState('Production');
  const [assigneeId, setAssigneeId] = useState<number | undefined>(undefined);
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [isSecuritySensitive, setIsSecuritySensitive] = useState(false);

  // AI states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [qualityScore, setQualityScore] = useState<AIQualityScoreResponse | null>(null);
  const [duplicateCheck, setDuplicateCheck] = useState<AIDuplicateCheckResponse | null>(null);
  const [triageRecommendation, setTriageRecommendation] = useState<AITriageResponse | null>(null);
  const [dismissedDuplicateId, setDismissedDuplicateId] = useState<number | null>(null);
  const [isGeneratingSteps, setIsGeneratingSteps] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'ai_insights'>('editor');

  // Auto-captured technical context
  const [techContext, setTechContext] = useState<any>({
    browser: 'Chrome 122.0',
    os: 'macOS Sonoma / Windows 11',
    screen_resolution: `${window.innerWidth}x${window.innerHeight}`,
    app_version: 'v2.5.0',
    environment: 'Production'
  });

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent;
      let browser = 'Chrome';
      if (ua.includes('Firefox')) browser = 'Firefox';
      else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
      else if (ua.includes('Edg')) browser = 'Edge';

      let os = 'Windows';
      if (ua.includes('Mac')) os = 'macOS';
      else if (ua.includes('Linux')) os = 'Linux';
      else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

      setTechContext({
        browser,
        os,
        screen_resolution: `${window.screen?.width || window.innerWidth}x${window.screen?.height || window.innerHeight}`,
        app_version: 'v2.5.0',
        environment
      });
    }
  }, [environment]);

  // Run Real-time Quality & Duplicate Check debounced
  useEffect(() => {
    if (!title.trim() && !description.trim()) return;

    const timer = setTimeout(async () => {
      try {
        // Run quality analyzer
        const qRes = await api.aiQualityScore({
          title,
          description,
          steps_to_reproduce: stepsToReproduce,
          expected_behavior: expectedBehavior,
          actual_behavior: actualBehavior,
          technical_context: techContext
        });
        setQualityScore(qRes);

        // Run duplicate check if title is long enough
        if (title.length >= 8) {
          const dRes = await api.aiDuplicateCheck(title, description, currentProject?.id);
          setDuplicateCheck(dRes);
        }
      } catch (err) {
        console.error('AI check error:', err);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [title, description, stepsToReproduce, expectedBehavior, actualBehavior, currentProject]);

  // Run AI Triage Engine
  const handleRunAITriage = async () => {
    if (!title.trim() && !description.trim()) return;
    setIsAnalyzing(true);
    try {
      const res = await api.aiTriage(title, description, stepsToReproduce, currentProject?.id);
      setTriageRecommendation(res);
      setActiveTab('ai_insights');
    } catch (err) {
      console.error('AI triage error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Run AI Step Generator ("Tidy with AI")
  const handleTidySteps = async () => {
    const textToTidy = stepsToReproduce.trim() || description.trim();
    if (!textToTidy) return;

    setIsGeneratingSteps(true);
    try {
      const res = await api.aiReproductionSteps(textToTidy);
      setStepsToReproduce(res.structured_steps.map((s, idx) => `${idx + 1}. ${s}`).join('\n'));
      if (!expectedBehavior) setExpectedBehavior(res.expected_behavior);
      if (!actualBehavior) setActualBehavior(res.actual_behavior);
      if (res.summary_title && !title) setTitle(res.summary_title);
    } catch (err) {
      console.error('AI Step generation error:', err);
    } finally {
      setIsGeneratingSteps(false);
    }
  };

  // Apply All AI Triage recommendations
  const handleApplyAllAI = () => {
    if (!triageRecommendation) return;
    setCategory(triageRecommendation.category);
    setComponent(triageRecommendation.component);
    setSeverity(triageRecommendation.severity);
    setPriority(triageRecommendation.priority);
    setLabels(Array.from(new Set([...labels, ...triageRecommendation.suggested_labels])));
    if (triageRecommendation.suggested_assignee_id) {
      setAssigneeId(triageRecommendation.suggested_assignee_id);
    }
  };

  const handleAddLabel = () => {
    if (labelInput.trim() && !labels.includes(labelInput.trim())) {
      setLabels([...labels, labelInput.trim()]);
      setLabelInput('');
    }
  };

  const handleRemoveLabel = (lbl: string) => {
    setLabels(labels.filter((l) => l !== lbl));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    try {
      await api.createBug({
        project_id: currentProject?.id || 1,
        title,
        description,
        steps_to_reproduce: stepsToReproduce,
        expected_behavior: expectedBehavior,
        actual_behavior: actualBehavior,
        category,
        component,
        severity,
        priority,
        environment,
        assignee_id: assigneeId,
        labels,
        is_security_sensitive: isSecuritySensitive,
        technical_context: techContext,
        quality_score: qualityScore?.score || 75
      });
      onBugCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create bug:', err);
      alert('Failed to submit bug. Please verify inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Intelligent Bug Reporter</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold font-mono">
                  {currentProject?.key || 'PROJ'}
                </span>
              </h2>
              <p className="text-xs text-slate-500">Live Quality Evaluation • Deduplication • Triage Recommendations</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Bug Quality Meter */}
            {qualityScore && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-500">Report Quality:</span>
                <span className={`text-xs font-bold ${
                  qualityScore.score >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                  qualityScore.score >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {qualityScore.score}/100 ({qualityScore.grade})
                </span>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Possible Duplicate Alert Banner */}
        {duplicateCheck && duplicateCheck.duplicates.length > 0 && duplicateCheck.duplicates[0].bug_id !== dismissedDuplicateId && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  {duplicateCheck.is_possible_regression ? 'Possible Regression Detected' : 'Possible Duplicate Detected'} ({duplicateCheck.duplicates[0].similarity_score}% similarity)
                </div>
                <div className="text-xs text-amber-700 dark:text-amber-300">
                  Matches <span className="font-mono font-bold">{duplicateCheck.duplicates[0].bug_key}</span>: "{duplicateCheck.duplicates[0].title}"
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDismissedDuplicateId(duplicateCheck.duplicates[0].bug_id)}
                className="px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-500/20 rounded cursor-pointer"
              >
                Mark as Not Duplicate
              </button>
              <button
                onClick={() => window.open(`#/bug/${duplicateCheck.duplicates[0].bug_id}`, '_blank')}
                className="px-2.5 py-1 text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 rounded cursor-pointer"
              >
                View Existing Bug
              </button>
            </div>
          </div>
        )}

        {/* Modal Body: 2-Column Layout */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form Fields (2 Cols) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Bug Summary / Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Users are randomly logged out after refreshing dashboard"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
              />
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Description & Context <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleRunAITriage}
                  disabled={isAnalyzing || !title.trim()}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  <span>{isAnalyzing ? 'Analyzing with AI...' : 'Auto-Triage with AI'}</span>
                </button>
              </div>
              <textarea
                rows={3}
                placeholder="Explain the problem narrative, what went wrong, symptoms, and impact..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>

            {/* Reproduction Steps with "Tidy with AI" button */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Steps to Reproduce
                </label>
                <button
                  type="button"
                  onClick={handleTidySteps}
                  disabled={isGeneratingSteps || (!stepsToReproduce.trim() && !description.trim())}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-xs font-semibold hover:bg-purple-500/20 transition-all cursor-pointer disabled:opacity-50"
                  title="Converts unstructured messy text into structured 1-2-3 steps"
                >
                  <Bot className={`w-3.5 h-3.5 ${isGeneratingSteps ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingSteps ? 'Formatting Steps...' : 'Tidy with AI (Structure Steps)'}</span>
                </button>
              </div>
              <textarea
                rows={3}
                placeholder="1. Open app&#10;2. Click on payment checkout&#10;3. Observe crash"
                value={stepsToReproduce}
                onChange={(e) => setStepsToReproduce(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 text-xs font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>

            {/* Expected vs Actual Outcomes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Expected Behavior
                </label>
                <textarea
                  rows={2}
                  placeholder="What should have happened..."
                  value={expectedBehavior}
                  onChange={(e) => setExpectedBehavior(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 text-xs focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Actual Behavior
                </label>
                <textarea
                  rows={2}
                  placeholder="What actually occurred instead..."
                  value={actualBehavior}
                  onChange={(e) => setActualBehavior(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 text-xs focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Technical Context Preview */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Client Context:</span>
                <span className="font-mono text-slate-500">{techContext.browser} • {techContext.os} • {techContext.screen_resolution} • {environment}</span>
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Auto-Enriched</span>
            </div>
          </div>

          {/* Right Sidebar: AI Triage & Metadata Fields (1 Col) */}
          <div className="space-y-4">
            {/* AI Triage Recommendation Box */}
            {triageRecommendation ? (
              <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-indigo-500/10 border border-blue-500/20 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                    <Sparkles className="w-4 h-4 text-blue-500" />
                    <span>AI Triage Recommendation</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyAllAI}
                    className="text-[11px] px-2 py-0.5 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    Apply All
                  </button>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <div><span className="font-semibold text-slate-400">Category:</span> {triageRecommendation.category}</div>
                  <div><span className="font-semibold text-slate-400">Component:</span> {triageRecommendation.component}</div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-400">Severity:</span>
                    <SeverityBadge severity={triageRecommendation.severity} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-400">Priority:</span>
                    <PriorityBadge priority={triageRecommendation.priority} />
                  </div>
                  {triageRecommendation.suggested_assignee && (
                    <div><span className="font-semibold text-slate-400">Recommended Assignee:</span> {triageRecommendation.suggested_assignee}</div>
                  )}
                </div>

                <div className="text-[11px] italic text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                  {triageRecommendation.reasoning}
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                <Sparkles className="w-5 h-5 text-blue-500 mx-auto" />
                <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  AI Triage Engine Ready
                </div>
                <button
                  type="button"
                  onClick={handleRunAITriage}
                  disabled={isAnalyzing || !title.trim()}
                  className="px-3 py-1 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  Analyze & Suggest
                </button>
              </div>
            )}

            {/* Quality Checklist */}
            {qualityScore && qualityScore.missing_elements.length > 0 && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                <div className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider">
                  Suggestions to improve report:
                </div>
                <ul className="space-y-1 text-slate-500 dark:text-slate-400 list-disc list-inside">
                  {qualityScore.missing_elements.slice(0, 3).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Classification Metadata Fields */}
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                  >
                    <option value="General">General</option>
                    <option value="Authentication">Authentication</option>
                    <option value="Billing & Payments">Billing & Payments</option>
                    <option value="Frontend UI/UX">Frontend UI/UX</option>
                    <option value="Database & Persistence">Database</option>
                    <option value="DevOps & Infrastructure">DevOps & Cloud</option>
                    <option value="API & Integration">API & Core</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Component</label>
                  <input
                    type="text"
                    value={component}
                    onChange={(e) => setComponent(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as BugSeverity)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 font-semibold"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as BugPriority)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 font-semibold"
                  >
                    <option value="P1">P1 (24h SLA)</option>
                    <option value="P2">P2 (72h SLA)</option>
                    <option value="P3">P3 (7d SLA)</option>
                    <option value="P4">P4 (14d SLA)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Assignee</label>
                <select
                  value={assigneeId || ''}
                  onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="">Unassigned</option>
                  {allUsers.filter((u) => u.role === 'DEVELOPER').map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name} (Developer)</option>
                  ))}
                </select>
              </div>

              {/* Labels */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Labels</label>
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  {labels.map((l) => (
                    <span key={l} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs">
                      <span>{l}</span>
                      <button type="button" onClick={() => handleRemoveLabel(l)} className="text-slate-400 hover:text-rose-500 cursor-pointer">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Add label..."
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLabel(); }}}
                    className="w-full px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddLabel}
                    className="px-2.5 py-1 text-xs font-semibold bg-slate-200 dark:bg-slate-700 rounded-lg hover:bg-slate-300 cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Security sensitive checkbox */}
              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isSecuritySensitive}
                    onChange={(e) => setIsSecuritySensitive(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>Restricted Security-Sensitive Issue</span>
                </label>
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="lg:col-span-3 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              AI recommendations will be preserved as audit records upon creation.
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating Bug...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Create Issue</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
