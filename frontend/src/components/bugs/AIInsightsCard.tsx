import React, { useState, useEffect } from 'react';
import { Sparkles, Brain, Zap, UserCheck, AlertOctagon, History, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { Bug, AIAssigneeRecommendResponse, AssigneeMatch } from '../../types';
import { api } from '../../services/api';

interface AIInsightsCardProps {
  bug: Bug;
  onAssignDeveloper: (userId: number) => void;
}

export const AIInsightsCard: React.FC<AIInsightsCardProps> = ({ bug, onAssignDeveloper }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [assigneeData, setAssigneeData] = useState<AIAssigneeRecommendResponse | null>(null);
  const [loadingAssignees, setLoadingAssignees] = useState(false);

  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoadingAssignees(true);
      try {
        const res = await api.aiRecommendAssignee({
          component: bug.component,
          category: bug.category,
          severity: bug.severity,
          title: bug.title,
          description: bug.description,
          project_id: bug.project_id
        });
        setAssigneeData(res);
      } catch (err) {
        console.error('Failed to load assignee recommendations:', err);
      } finally {
        setLoadingAssignees(false);
      }
    };

    fetchRecommendations();
  }, [bug]);

  // Check for regression relations
  const regressionRel = bug.relations?.find((r) => r.relation_type === 'REGRESSION_OF');

  return (
    <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-purple-500/5 dark:bg-slate-900 overflow-hidden shadow-xs">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-blue-500/10 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-100">
            AI Intelligence & Impact Scoring
          </span>
          <span className="text-[10px] px-2 py-0.2 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold">
            Impact: {bug.impact_score}/100
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <span className="text-xs">{isExpanded ? 'Collapse' : 'Expand'}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-5 border-t border-blue-500/10 space-y-4 text-xs">
          {/* Possible Regression Alert Banner */}
          {regressionRel && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <History className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <div>
                  <span className="font-bold text-rose-900 dark:text-rose-200">Historical Regression Trace:</span>
                  <span className="text-rose-700 dark:text-rose-300 ml-1.5">
                    This issue resembles resolved defect <span className="font-mono font-bold">{regressionRel.target_bug_key}</span> ("{regressionRel.target_bug_title}")
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold uppercase">
                Regression
              </span>
            </div>
          )}

          {/* Impact Score Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 space-y-2">
              <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                <span>Impact Assessment Breakdown</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{bug.impact_score}/100</span>
              </div>
              <div className="space-y-1.5 text-slate-500 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Severity Baseline ({bug.severity}):</span>
                  <span className="font-mono font-semibold">{bug.severity === 'CRITICAL' ? '40 pts' : bug.severity === 'HIGH' ? '30 pts' : '18 pts'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Environment Target ({bug.environment}):</span>
                  <span className="font-mono font-semibold">{bug.environment === 'Production' ? '15 pts' : '4 pts'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Quality Score:</span>
                  <span className="font-mono font-semibold">{bug.quality_score}/100</span>
                </div>
              </div>
            </div>

            {/* AI Developer Matching Recommendation */}
            <div className="p-3.5 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 space-y-2">
              <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-500" />
                <span>Intelligent Assignee Matching</span>
              </div>
              {loadingAssignees ? (
                <div className="text-slate-400 py-2">Computing developer skill matrices...</div>
              ) : assigneeData?.recommended_assignees ? (
                <div className="space-y-2">
                  {assigneeData.recommended_assignees.slice(0, 3).map((match: AssigneeMatch) => (
                    <div
                      key={match.user_id}
                      className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                    >
                      <div className="truncate">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          <span>{match.name}</span>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{match.match_score}% match</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{match.rationale}</div>
                      </div>
                      {bug.assignee_id !== match.user_id && (
                        <button
                          onClick={() => onAssignDeveloper(match.user_id)}
                          className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[10px] shrink-0 ml-2 cursor-pointer"
                        >
                          Assign
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-400">No assignee recommendations available</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
