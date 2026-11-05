import React, { useState } from 'react';
import { ActiveTab } from './types';
import { useRealtimeStore } from './hooks/useRealtimeStore';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { OfflineBanner } from './components/OfflineBanner';
import { UndoToast } from './components/UndoToast';
import { AuthModal } from './components/AuthModal';
import { ConnectionModal } from './components/ConnectionModal';
import { DashboardView } from './components/Dashboard/DashboardView';
import { MilestonesView } from './components/Milestones/MilestonesView';
import { MeetingsView } from './components/Meetings/MeetingsView';
import { DocumentsView } from './components/Documents/DocumentsView';
import { TeamView } from './components/Team/TeamView';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

export default function App() {
  const { authStatus, dbError, clearDbError, retrySync } = useRealtimeStore();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [connectionInitialTab, setConnectionInitialTab] = useState<'connection' | 'import'>('connection');

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#F5F7F4] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-[#103B2B] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-stone-600">Loading SpiceGuard Hub...</p>
        </div>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-[#F5F7F4]">
        <AuthModal
          isOpen={true}
          onClose={() => {}}
          requireAuth={true}
          onOpenConnection={() => setConnectionModalOpen(true)}
        />
        <ConnectionModal
          isOpen={connectionModalOpen}
          onClose={() => setConnectionModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7F4] text-stone-900 flex font-sans selection:bg-[#103B2B]/15 selection:text-[#103B2B]">
      {/* Offline Status Indicator */}
      <OfflineBanner />

      {/* Navigation Sidebar (Desktop Left, Mobile Bottom) */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      {/* Main Content Area on Right */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          onOpenAuth={() => setAuthModalOpen(true)}
          onOpenConnection={() => {
            setConnectionInitialTab('connection');
            setConnectionModalOpen(true);
          }}
        />

        {dbError && (
          <div className="mx-4 sm:mx-8 mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="truncate">{dbError}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => retrySync()}
                className="px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-900 font-semibold flex items-center gap-1 transition"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
              <button
                type="button"
                onClick={clearDbError}
                className="p-1 text-red-500 hover:text-red-800"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Dynamic View Content */}
        <main className="flex-1 min-w-0 px-4 sm:px-8 pb-20 md:pb-12 overflow-y-auto">
          {activeTab === 'dashboard' && <DashboardView onNavigateTab={setActiveTab} />}

          {activeTab === 'milestones' && <MilestonesView />}

          {activeTab === 'meetings' && <MeetingsView />}

          {activeTab === 'documents' && <DocumentsView />}

          {activeTab === 'team' && <TeamView />}
        </main>
      </div>

      {/* 10-Second Task Deletion Undo Toast */}
      <UndoToast />

      {/* Modals */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onOpenConnection={() => {
          setAuthModalOpen(false);
          setConnectionInitialTab('connection');
          setConnectionModalOpen(true);
        }}
      />

      <ConnectionModal
        isOpen={connectionModalOpen}
        onClose={() => setConnectionModalOpen(false)}
        initialTab={connectionInitialTab}
      />
    </div>
  );
}
