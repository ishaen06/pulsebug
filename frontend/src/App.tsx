import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { IssuesPage } from './pages/IssuesPage';
import { IssueDetailPage } from './pages/IssueDetailPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { BugCreateModal } from './components/bugs/BugCreateModal';
import { CommandPalette } from './components/common/CommandPalette';
import { api } from './services/api';
import { Bug } from './types';

const MainApp: React.FC = () => {
  const { user, currentProject } = useAuth();
  const [currentView, setCurrentView] = useState<string>('issues');
  const [selectedBugId, setSelectedBugId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isCommandOpen, setIsCommandOpen] = useState<boolean>(false);
  const [allBugs, setAllBugs] = useState<Bug[]>([]);

  const loadAllBugs = async () => {
    try {
      const bugs = await api.getBugs();
      setAllBugs(bugs);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadAllBugs();
  }, [currentProject, user]);

  const handleSelectBug = (bug: Bug) => {
    setSelectedBugId(bug.id);
    setCurrentView('detail');
  };

  const handleSelectBugId = (bugId: number) => {
    setSelectedBugId(bugId);
    setCurrentView('detail');
  };

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
