import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Bug as BugIcon, UserCheck, RefreshCw, MessageSquare, AlertTriangle, CheckCircle, Bell, X } from 'lucide-react';

export interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  bug_key?: string;
  bug_id?: number;
  timestamp: string;
}

interface WebSocketContextType {
  isConnected: boolean;
  toasts: Toast[];
  lastEvent: any;
  dismissToast: (id: string) => void;
  broadcastEvent: (type: string, payload: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lastEvent, setLastEvent] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const addToast = (type: Toast['type'], title: string, message: string, bug_key?: string, bug_id?: number) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = {
      id,
      type,
      title,
      message,
      bug_key,
      bug_id,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setToasts((prev) => [newToast, ...prev].slice(0, 5));
    setTimeout(() => {
      dismissToast(id);
    }, 7000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    let wsUrl: string;
    if (import.meta.env.VITE_WS_URL) {
      wsUrl = import.meta.env.VITE_WS_URL;
    } else if (import.meta.env.VITE_API_URL) {
      const backendUrl = import.meta.env.VITE_API_URL.replace(/\/+$/, '');
      const wsProtocol = backendUrl.startsWith('https:') ? 'wss:' : 'ws:';
      const hostPart = backendUrl.replace(/^https?:\/\//, '');
      wsUrl = `${wsProtocol}//${hostPart}/ws`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? `${window.location.hostname}:8000`
        : window.location.host;
      wsUrl = `${protocol}//${host}/ws`;
    }

    let reconnectTimer: any;

    const connect = () => {
      try {
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          setIsConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setLastEvent(data);

            if (data.type === 'BUG_CREATED') {
              addToast(
                'info',
                `🐞 New Bug Reported: ${data.bug_key}`,
                `${data.reporter_name} reported "${data.title}" [${data.priority}]`,
                data.bug_key,
                data.bug_id
              );
            } else if (data.type === 'BUG_ASSIGNED') {
              addToast(
                'success',
                `👤 Task Assigned: ${data.bug_key}`,
                data.message || `Assigned to ${data.assignee_name}`,
                data.bug_key,
                data.bug_id
              );
            } else if (data.type === 'STATUS_CHANGED') {
              addToast(
                'warning',
                `🔄 Status Transition: ${data.bug_key}`,
                data.message || `Status changed from ${data.old_status} to ${data.new_status}`,
                data.bug_key,
                data.bug_id
              );
            } else if (data.type === 'NEW_COMMENT') {
              addToast(
                'info',
                `💬 New Comment on ${data.bug_key}`,
                data.message || `${data.author}: ${data.content}`,
                data.bug_key,
                data.bug_id
              );
            } else if (data.type === 'PR_EVENT') {
              addToast(
                'success',
                `Git PR Event: ${data.bug_key}`,
                data.message || 'Git PR event synchronized',
                data.bug_key,
                data.bug_id
              );
            } else if (data.type === 'NOTIFICATION') {
              addToast('info', data.title, data.message, data.bug_key, data.bug_id);
            }
          } catch {
            // ignore non-json messages
          }
        };

        socket.onclose = () => {
          setIsConnected(false);
          reconnectTimer = setTimeout(connect, 3000);
        };

        socket.onerror = () => {
          socket.close();
        };

        wsRef.current = socket;
      } catch (err) {
        reconnectTimer = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const broadcastEvent = (type: string, payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...payload }));
    }
  };

  return (
    <WebSocketContext.Provider value={{ isConnected, toasts, lastEvent, dismissToast, broadcastEvent }}>
      {children}
      {/* Toast Notification Container with Rich Popups */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-xl shadow-xl border backdrop-blur-xl transition-all transform animate-in slide-in-from-bottom-2 duration-200 flex items-start gap-3 ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-100 border-emerald-500/40 shadow-emerald-950/30'
                : toast.type === 'warning'
                ? 'bg-amber-950/90 text-amber-100 border-amber-500/40 shadow-amber-950/30'
                : toast.type === 'error'
                ? 'bg-rose-950/90 text-rose-100 border-rose-500/40 shadow-rose-950/30'
                : 'bg-slate-900/95 text-slate-100 border-blue-500/40 shadow-slate-950/40'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {toast.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              ) : toast.type === 'warning' ? (
                <RefreshCw className="w-4 h-4 text-amber-400" />
              ) : toast.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              ) : (
                <Bell className="w-4 h-4 text-blue-400 animate-bounce" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  {toast.title}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">{toast.timestamp}</span>
              </div>
              <p className="text-xs mt-1 text-slate-200 font-medium leading-relaxed">
                {toast.message}
              </p>
              {toast.bug_key && (
                <div className="mt-2">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-white/15 text-[10px] font-mono font-bold text-white border border-white/20">
                    {toast.bug_key}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => dismissToast(toast.id)}
              className="p-1 rounded-md hover:bg-white/20 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error('useWebSocket must be used within WebSocketProvider');
  return context;
};
