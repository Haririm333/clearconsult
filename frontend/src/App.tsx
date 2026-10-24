import { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { PatientIntake } from './pages/PatientIntake';
import { DoctorDashboard } from './pages/DoctorDashboard';
import { Home } from './pages/Home';
import { HowToGuidesModal } from './components/HowToGuidesModal';
import { SkinPhotoTriageModal } from './components/SkinPhotoTriageModal';
import type { SessionState } from './types';
import { getSession, resetSession, loadTamilDemoScenario } from './api';

export function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [sessionId, setSessionId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('session') || 'demo-tamil-session';
  });
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGuidesOpen, setIsGuidesOpen] = useState(false);
  const [isSkinTriageOpen, setIsSkinTriageOpen] = useState(false);

  // Path change listener for client-side navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Fetch or sync session state
  const refreshSession = useCallback(async () => {
    try {
      const data = await getSession(sessionId);
      setSessionState(data);
    } catch (err) {
      console.warn('Session sync warning (backend may be booting):', err);
    }
  }, [sessionId]);

  // Initial load and periodic polling for real-time multi-tab sync
  useEffect(() => {
    refreshSession();
    const interval = setInterval(refreshSession, 2500);
    return () => clearInterval(interval);
  }, [refreshSession]);

  const handleReset = async () => {
    setIsLoading(true);
    try {
      const res = await resetSession(sessionId);
      setSessionState(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadTamilDemo = async () => {
    setIsLoading(true);
    try {
      await loadTamilDemoScenario(sessionId);
      await refreshSession();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8faf9] text-[#0f172a]">
      <Navbar
        currentPath={currentPath}
        sessionId={sessionId}
        onSessionChange={(newId) => {
          setSessionId(newId);
          const url = new URL(window.location.href);
          url.searchParams.set('session', newId);
          window.history.replaceState({}, '', url.toString());
        }}
        onLoadTamilDemo={handleLoadTamilDemo}
        onReset={handleReset}
        onOpenGuides={() => setIsGuidesOpen(true)}
        onOpenSkinTriage={() => setIsSkinTriageOpen(true)}
        isLoading={isLoading}
      />

      <main className="flex-1 flex flex-col">
        {currentPath === '/patient' ? (
          <PatientIntake
            sessionId={sessionId}
            sessionState={sessionState}
            onRefreshSession={refreshSession}
            onOpenGuides={() => setIsGuidesOpen(true)}
            onOpenSkinTriage={() => setIsSkinTriageOpen(true)}
          />
        ) : currentPath === '/doctor' ? (
          <DoctorDashboard
            sessionId={sessionId}
            sessionState={sessionState}
            onRefresh={refreshSession}
            onSelectSession={(newId) => {
              setSessionId(newId);
              const url = new URL(window.location.href);
              url.searchParams.set('session', newId);
              window.history.replaceState({}, '', url.toString());
              refreshSession();
            }}
            isLoading={isLoading}
            onOpenGuides={() => setIsGuidesOpen(true)}
            onOpenSkinTriage={() => setIsSkinTriageOpen(true)}
          />
        ) : (
          <Home
            sessionId={sessionId}
            onNavigate={navigateTo}
            onRefresh={refreshSession}
          />
        )}
      </main>

      {/* Modals for Phase 5 & 6 */}
      <HowToGuidesModal
        isOpen={isGuidesOpen}
        onClose={() => setIsGuidesOpen(false)}
        defaultLang={(sessionState?.language as any) || 'ta'}
      />

      <SkinPhotoTriageModal
        isOpen={isSkinTriageOpen}
        onClose={() => setIsSkinTriageOpen(false)}
      />

      <Footer />
    </div>
  );
}

export default App;
