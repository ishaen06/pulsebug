import React, { useState, useEffect } from 'react';
import {
  Activity, ShieldAlert, Clock, AlertTriangle, TrendingUp, CheckCircle2,
  Users, BarChart3, PieChart as PieIcon, LineChart as LineIcon, Layers, Flame
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { ProjectHealthResponse, ManagerDashboardResponse, HealthFactor } from '../types';

export const AnalyticsPage: React.FC = () => {
  const { currentProject, projects, allUsers, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'health' | 'developer' | 'qa'>('health');
  const [healthData, setHealthData] = useState<ProjectHealthResponse | null>(null);
  const [managerData, setManagerData] = useState<ManagerDashboardResponse | null>(null);
  const [developerData, setDeveloperData] = useState<any>(null);
  const [qaData, setQAData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const projectId = currentProject?.id || projects[0]?.id || 1;

    try {
      const results = await Promise.allSettled([
        api.getProjectHealth(projectId),
        api.getManagerAnalytics(projectId),
        api.getDeveloperAnalytics(),
        api.getQAAnalytics(projectId)
      ]);

      if (results[0].status === 'fulfilled') setHealthData(results[0].value);
      if (results[1].status === 'fulfilled') setManagerData(results[1].value);
      if (results[2].status === 'fulfilled') setDeveloperData(results[2].value);
      if (results[3].status === 'fulfilled') setQAData(results[3].value);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentProject, projects]);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-sm">
        Computing real-time analytics & health matrices...
      </div>
    );
  }

  const severityChartData = managerData?.severity_breakdown
    ? [
        { name: 'Critical', value: managerData.severity_breakdown.CRITICAL || 0, color: '#f43f5e' },
        { name: 'High', value: managerData.severity_breakdown.HIGH || 0, color: '#f97316' },
        { name: 'Medium', value: managerData.severity_breakdown.MEDIUM || 0, color: '#eab308' },
        { name: 'Low', value: managerData.severity_breakdown.LOW || 0, color: '#64748b' }
      ]
    : [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" />
            <span>Project Health Engine & Analytics</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Diagnostic stability scores, SLA compliance, resolution velocity, and role-tailored dashboards
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('health')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'health' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Project Health
          </button>
          <button
            onClick={() => setActiveTab('developer')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'developer' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Developer View
          </button>
          <button
            onClick={() => setActiveTab('qa')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'qa' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Tester View
          </button>
        </div>
      </div>

      {/* TAB 1: PROJECT HEALTH ENGINE */}
      {activeTab === 'health' && healthData && (
        <div className="space-y-6">
          {/* Top Score Banner & Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Health Score Gauge */}
            <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-blue-50/30 dark:from-slate-900 dark:to-blue-950/20 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Project Health</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className={`text-4xl font-black ${
                    healthData.overall_health_score >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                    healthData.overall_health_score >= 65 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {healthData.overall_health_score}
                  </span>
                  <span className="text-slate-400 text-sm font-semibold">/ 100</span>
                </div>
              </div>
              <div className="mt-3">
                <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 font-mono">
                  {healthData.health_grade}
                </span>
              </div>
            </div>

            {/* Critical Open Bugs */}
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Critical P1 Issues</span>
                  <Flame className="w-4 h-4 text-rose-500" />
                </span>
                <div className="text-3xl font-black text-rose-600 dark:text-rose-400 mt-2">
                  {healthData.critical_open_bugs}
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-2">Immediate blocker count</div>
            </div>

            {/* Overdue SLA Bugs */}
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Overdue SLA Breaches</span>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </span>
                <div className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-2">
                  {healthData.overdue_sla_bugs}
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-2">Breached SLA deadline</div>
            </div>

            {/* Regression Rate */}
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Regression Rate</span>
                  <TrendingUp className="w-4 h-4 text-purple-500" />
                </span>
                <div className="text-3xl font-black text-purple-600 dark:text-purple-400 mt-2">
                  {healthData.regression_rate}%
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-2">Avg resolution: {healthData.avg_resolution_time_days} days</div>
            </div>
          </div>

          {/* Diagnostic Root Cause Warnings */}
          {healthData.root_cause_warnings.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs">
              <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Health Diagnostic Alerts (Why is the score impacted?):</span>
              </div>
              <ul className="space-y-1 text-amber-800 dark:text-amber-300 list-disc list-inside pl-1">
                {healthData.root_cause_warnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Health Factors Contribution List */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
            <div className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">
              Stability Factors Breakdown
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {healthData.health_factors.map((factor, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-start justify-between text-xs gap-3"
                >
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">{factor.factor_name}</div>
                    <div className="text-slate-500 dark:text-slate-400 mt-1">{factor.diagnostic_message}</div>
                  </div>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs shrink-0 ${
                    factor.score_contribution < 0 ? 'bg-rose-500/15 text-rose-600' : 'bg-emerald-500/15 text-emerald-600'
                  }`}>
                    {factor.score_contribution > 0 ? `+${factor.score_contribution}` : factor.score_contribution} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
          {/* Charts Row: Trend Line & Severity Donut */}
          {managerData && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Trend History */}
              <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-3">
                <div className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center justify-between">
                  <span>Issue Resolution Trend (Last 7 Days)</span>
                  <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold">SLA: {managerData.sla_compliance_rate}%</span>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={managerData.trend_history}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '6px', color: '#fff', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Line type="monotone" dataKey="opened" stroke="#3b82f6" strokeWidth={2} name="Opened Issues" />
                      <Line type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} name="Resolved Issues" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Severity Distribution */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-3">
                <div className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Severity Breakdown
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={severityChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {severityChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DEVELOPER DASHBOARD */}
      {activeTab === 'developer' && developerData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">My Assigned Issues</span>
              <div className="text-3xl font-black text-blue-600 dark:text-blue-400 mt-1">{developerData.my_assigned_bugs_count}</div>
            </div>
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">In Development</span>
              <div className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">{developerData.my_in_progress_count}</div>
            </div>
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Pull Requests</span>
              <div className="text-3xl font-black text-purple-600 dark:text-purple-400 mt-1">{developerData.my_active_prs_count}</div>
            </div>
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Resolved This Week</span>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{developerData.my_resolved_this_week}</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-3">
            <div className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">
              My Active Queue
            </div>
            <div className="space-y-2 text-xs">
              {developerData.my_bugs_list.map((bug: any) => (
                <div key={bug.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-600">{bug.bug_key}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{bug.title}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold">{bug.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: QA / TESTER DASHBOARD */}
      {activeTab === 'qa' && qaData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ready for Verification</span>
              <div className="text-3xl font-black text-teal-600 dark:text-teal-400 mt-1">{qaData.ready_for_testing_count}</div>
            </div>
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Regression Defect Alerts</span>
              <div className="text-3xl font-black text-rose-600 dark:text-rose-400 mt-1">{qaData.regression_bugs_count}</div>
            </div>
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Reopened Defects</span>
              <div className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">{qaData.reopened_bugs_count}</div>
            </div>
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Avg Turnaround Time</span>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{qaData.verification_turnaround_hours}h</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-3">
            <div className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">
              QA Verification Queue
            </div>
            <div className="space-y-2 text-xs">
              {qaData.test_verification_queue.map((bug: any) => (
                <div key={bug.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-teal-600">{bug.bug_key}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{bug.title}</span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">{bug.component}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
