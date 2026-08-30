import React from 'react';
import {
  LayoutDashboard,
  Bug,
  KanbanSquare,
  Activity,
  Sparkles,
  GitBranch,
  Settings,
  Shield,
  Zap
} from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketContext';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onSelectView }) => {
  const { isConnected } = useWebSocket();
  const { currentProject } = useAuth();

  const navItems = [
    { id: 'issues', label: 'Issues & Triage', icon: Bug, badge: null },
    { id: 'board', label: 'Kanban Board', icon: KanbanSquare, badge: null },
    { id: 'analytics', label: 'Project Health & Analytics', icon: Activity, badge: 'AI Health' },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col justify-between select-none shrink-0">
      {/* Brand Header */}
      <div>
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 font-bold">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="font-black text-sm tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>PULSEBUG</span>
              <span className="text-[9px] px-1 py-0.2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-mono rounded font-semibold">2.0</span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium">Intelligent BugOps</div>
          </div>
        </div>

        {/* Project Context Badge */}
        {currentProject && (
          <div className="mx-3 mt-4 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Active Workspace</div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate mt-0.5">{currentProject.name}</div>
            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
              <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{currentProject.key}</span>
              <span>•</span>
              <span>{currentProject.open_bug_count} Open</span>
              {currentProject.critical_bug_count > 0 && (
                <>
                  <span>•</span>
                  <span className="text-rose-500 font-bold">{currentProject.critical_bug_count} P1</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="p-3 space-y-1 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Status Pill */}
      <div className="p-3 border-t border-slate-200/60 dark:border-slate-800/60">
        <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              {isConnected ? 'Real-Time Live' : 'Reconnecting...'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">v2.0</span>
        </div>
      </div>
    </aside>
  );
};
