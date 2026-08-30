import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { IssuesPage } from './pages/IssuesPage';
import { IssueDetailPage } from './pages/IssueDetailPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { LoginPage } from './pages/LoginPage';
import { BugCreateModal } from './components/bugs/BugCreateModal';
import { CommandPalette } from './components/common/CommandPalette';
import { api } from './services/api';
import { Bug } from './types';

const MainApp: React.FC = () => {
  const { user, loading: authLoading, currentProject, refreshProjects } = useAuth();
  const [currentView, setCurrentView] = useState<string>('issues');
  const [selectedBugId, setSelectedBugId] = useState<number | null>(null);
  const [resetToken, setResetToken] = useState<string>('');
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isCommandOpen, setIsCommandOpen] = useState<boolean>(false);
  const [allBugs, setAllBugs] = useState<Bug[]>([]);

  // Check URL path and query parameters for password reset & verification links on load
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tokenParam = urlParams.get('token');
      const verifyEmailParam = urlParams.get('verify_email') || urlParams.get('email');
      const path = window.location.pathname;

      if (tokenParam || path.includes('/reset-password')) {
        setResetToken(tokenParam || '');
        setCurrentView('reset-password');
      } else if (path.includes('/forgot-password')) {
        setCurrentView('forgot-password');
      } else if (verifyEmailParam || path.includes('/login') || path.includes('/register') || path.includes('/verify-email')) {
        setCurrentView('login');
      }
    } catch {
      // ignore
    }
  }, []);

  const loadAllBugs = async () => {
    try {
      const bugs = await api.getBugs();
      setAllBugs(bugs);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (user) {
      loadAllBugs();
    }
  }, [currentProject, user]);

  const handleSelectBug = (bug: Bug) => {
    setSelectedBugId(bug.id);
    setCurrentView('detail');
  };

  const handleSelectBugId = (bugId: number) => {
    setSelectedBugId(bugId);
    setCurrentView('detail');
  };

  // Full-screen Login & Registration & Email Verification View
  if (!user || currentView === 'login') {
    return (
      <LoginPage
        onSuccess={() => {
          setCurrentView('issues');
          refreshProjects();
          loadAllBugs();
        }}
        onForgotPassword={() => setCurrentView('forgot-password')}
      />
    );
  }

  // Standalone full-screen pages for Forgot Password & Reset Password
  if (currentView === 'forgot-password') {
    return (
      <ForgotPasswordPage
        onBackToLogin={() => setCurrentView('login')}
        onNavigateToReset={(token) => {
          setResetToken(token);
          setCurrentView('reset-password');
        }}
      />
    );
  }

  if (currentView === 'reset-password') {
    return (
      <ResetPasswordPage
        token={resetToken}
        onGoToLogin={() => {
          setResetToken('');
          setCurrentView('login');
          window.history.pushState({}, '', '/');
        }}
        onRequestNewLink={() => {
          setResetToken('');
          setCurrentView('forgot-password');
          window.history.pushState({}, '', '/forgot-password');
        }}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100">
      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={(view) => {
          setCurrentView(view);
          setSelectedBugId(null);
        }}
      />

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Navbar */}
        <Navbar
          onOpenCreate={() => setIsCreateOpen(true)}
          onOpenCommand={() => setIsCommandOpen(true)}
          onOpenForgotPassword={() => setCurrentView('forgot-password')}
          onOpenLogin={() => setCurrentView('login')}
        />

        {/* View Port */}
        <main className="flex-1 overflow-y-auto">
          {currentView === 'issues' && (
            <IssuesPage
              onSelectBug={handleSelectBug}
              onOpenCreate={() => setIsCreateOpen(true)}
              initialViewMode="table"
            />
          )}

          {currentView === 'board' && (
            <IssuesPage
              onSelectBug={handleSelectBug}
              onOpenCreate={() => setIsCreateOpen(true)}
              initialViewMode="kanban"
            />
          )}

          {currentView === 'detail' && selectedBugId && (
            <IssueDetailPage
              bugId={selectedBugId}
              onBack={() => {
                setCurrentView('issues');
                setSelectedBugId(null);
              }}
              onSelectAnotherBug={(id) => setSelectedBugId(id)}
            />
          )}

          {currentView === 'analytics' && (
            <AnalyticsPage />
          )}
        </main>
      </div>

      {/* Global Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        bugs={allBugs}
        onSelectBug={handleSelectBug}
        onOpenCreate={() => setIsCreateOpen(true)}
        onNavigate={(view) => {
          setCurrentView(view);
          setSelectedBugId(null);
        }}
      />

      {/* Intelligent Bug Create Modal */}
      <BugCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onBugCreated={() => {
          loadAllBugs();
          setCurrentView('issues');
        }}
      />
    </div>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WebSocketProvider>
          <MainApp />
        </WebSocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
