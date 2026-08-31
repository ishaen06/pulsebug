import React, { useState, useEffect } from 'react';
import {
  Search, Bell, Sparkles, Sun, Moon, CheckCircle2, ChevronDown,
  UserCheck, Shield, Layers, Plus, ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { api } from '../../services/api';
import { Notification } from '../../types';

interface NavbarProps {
  onOpenCreate: () => void;
  onOpenCommand: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCreate, onOpenCommand }) => {
  const { user, projects, currentProject, setCurrentProject, allUsers, switchUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isConnected, lastEvent } = useWebSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);

  const projectTimeoutRef = React.useRef<any>(null);
  const notifTimeoutRef = React.useRef<any>(null);
  const userTimeoutRef = React.useRef<any>(null);

  const fetchNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  // Real-time reactive notification trigger
  useEffect(() => {
    if (lastEvent) {
      fetchNotifications();
    }
  }, [lastEvent]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // ignore
    }
  };

  // Hover Handlers with subtle debounce for butter-smooth feel
  const handleProjectEnter = () => {
    if (projectTimeoutRef.current) clearTimeout(projectTimeoutRef.current);
    setShowProjectMenu(true);
  };
  const handleProjectLeave = () => {
    projectTimeoutRef.current = setTimeout(() => setShowProjectMenu(false), 120);
  };

  const handleNotifEnter = () => {
    if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);
    setShowNotifs(true);
  };
  const handleNotifLeave = () => {
    notifTimeoutRef.current = setTimeout(() => setShowNotifs(false), 120);
  };

  const handleUserEnter = () => {
    if (userTimeoutRef.current) clearTimeout(userTimeoutRef.current);
    setShowUserMenu(true);
  };
  const handleUserLeave = () => {
    userTimeoutRef.current = setTimeout(() => setShowUserMenu(false), 120);
  };

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 px-4 flex items-center justify-between">
      {/* Left section: Project Switcher & Search Bar */}
      <div className="flex items-center gap-4">
        {/* Project Selector Dropdown with smooth hover & click */}
        <div
          className="relative group"
          onMouseEnter={handleProjectEnter}
          onMouseLeave={handleProjectLeave}
        >
          <button
            onClick={() => setShowProjectMenu(!showProjectMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer shadow-xs"
          >
            <Layers className="w-4 h-4 text-blue-500" />
            <span>{currentProject?.name || 'All Projects'}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showProjectMenu ? 'rotate-180 text-blue-500' : ''}`} />
          </button>

          {/* Invisible hover bridge to prevent hover loss */}
          <div className="absolute top-full left-0 right-0 h-2" />

          {/* Smooth animated dropdown container */}
          <div
            className={`absolute left-0 top-[calc(100%+4px)] w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800/90 py-2 z-50 transition-all duration-200 ease-out origin-top-left ${
              showProjectMenu
                ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto visible'
                : 'opacity-0 scale-95 -translate-y-2 pointer-events-none invisible'
            }`}
          >
            <div className="px-3.5 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Switch Project</div>
            <div className="max-h-72 overflow-y-auto px-1 space-y-0.5">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setCurrentProject(p);
                    setShowProjectMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between hover:bg-blue-50/50 dark:hover:bg-slate-800/80 transition-all cursor-pointer ${
                    currentProject?.id === p.id ? 'bg-blue-50 dark:bg-blue-900/25 text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-700 dark:text-slate-200 font-medium'
                  }`}
                >
                  <div className="truncate">
                    <span className="font-mono text-xs font-bold mr-2 text-slate-400">{p.key}</span>
                    <span>{p.name}</span>
                  </div>
                  {p.critical_bug_count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/20">
                      {p.critical_bug_count} P1
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Global Search Bar (Cmd+K trigger) */}
        <button
          onClick={onOpenCommand}
          className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:border-slate-300 transition-all text-xs w-64 justify-between cursor-pointer"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5" />
            <span className="truncate">Search issues, actions...</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 text-slate-500">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right section: New Bug, Theme, Notifications, Persona Switcher */}
      <div className="flex items-center gap-2.5">
        {/* Report Bug with AI */}
        <button
          onClick={onOpenCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium cursor-pointer shadow-sm transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Report Issue</span>
          <span className="px-1 py-0.2 bg-blue-500 rounded text-[9px] font-bold uppercase tracking-wider">AI</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
        </button>

        {/* Notifications Bell with smooth hover & click */}
        <div
          className="relative group"
          onMouseEnter={handleNotifEnter}
          onMouseLeave={handleNotifLeave}
        >
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          {/* Invisible hover bridge */}
          <div className="absolute top-full right-0 w-32 h-2" />

          {/* Smooth animated notification drawer */}
          <div
            className={`absolute right-0 top-[calc(100%+4px)] w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800/90 py-2 z-50 transition-all duration-200 ease-out origin-top-right ${
              showNotifs
                ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto visible'
                : 'opacity-0 scale-95 -translate-y-2 pointer-events-none invisible'
            }`}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Notifications ({unreadCount} new)</span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50 px-1">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">No notifications</div>
              ) : (
                notifications.slice(0, 8).map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 rounded-lg text-xs transition-colors ${n.is_read ? 'opacity-70' : 'bg-blue-50/40 dark:bg-blue-900/15'}`}
                  >
                    <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                      <span>{n.title}</span>
                      {n.bug_key && <span className="font-mono text-[10px] text-blue-500 font-bold">{n.bug_key}</span>}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{n.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* User Persona & Role Switcher with smooth hover & click */}
        <div
          className="relative group"
          onMouseEnter={handleUserEnter}
          onMouseLeave={handleUserLeave}
        >
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-xs"
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.full_name} className="w-6 h-6 rounded-full object-cover border border-slate-300 dark:border-slate-700" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                {user?.full_name.charAt(0)}
              </div>
            )}
            <div className="text-left hidden md:block">
              <div className="text-xs font-semibold leading-none text-slate-900 dark:text-slate-100">{user?.full_name}</div>
              <div className="text-[10px] text-slate-400 font-medium leading-tight">{user?.role}</div>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180 text-blue-500' : ''}`} />
          </button>

          {/* Invisible hover bridge */}
          <div className="absolute top-full right-0 w-32 h-2" />

          {/* Smooth animated user switcher drawer */}
          <div
            className={`absolute right-0 top-[calc(100%+4px)] w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-slate-200/90 dark:border-slate-800/90 py-2 z-50 transition-all duration-200 ease-out origin-top-right ${
              showUserMenu
                ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto visible'
                : 'opacity-0 scale-95 -translate-y-2 pointer-events-none invisible'
            }`}
          >
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Logged in as</div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{user?.full_name}</div>
              <div className="text-xs text-blue-600 dark:text-blue-400 font-mono font-bold mt-0.5">{user?.role}</div>
            </div>

            <div className="px-3.5 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
              Switch Role Persona
            </div>
            <div className="space-y-0.5 px-1">
              {allUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    switchUser(u.email);
                    setShowUserMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between hover:bg-blue-50/50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer ${
                    user?.email === u.email ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${u.role === 'DEVELOPER' ? 'bg-emerald-500' : 'bg-teal-500'}`} />
                    <span className="font-medium">{u.full_name}</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono text-slate-400">{u.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
