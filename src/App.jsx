import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CryptoProvider, useCrypto } from './context/CryptoContext';
import { ChatProvider } from './context/ChatContext';
import Header from './components/layout/Header';
import BottomNav from './components/layout/BottomNav';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import Chat from './pages/Chat';
import Fun from './pages/Fun';
import Statistics from './pages/Statistics';
import Memories from './pages/Memories';
import Settings from './pages/Settings';
import MoodModal from './components/mood/MoodModal';
import StartupScreen from './components/startup/StartupScreen';
import SaviourLogo from './components/common/SaviourLogo';
import E2EESetupModal from './components/crypto/E2EESetupModal';
import E2EEUnlockModal from './components/crypto/E2EEUnlockModal';
import SafetyNumberModal from './components/crypto/SafetyNumberModal';
import KeyMismatchBanner from './components/crypto/KeyMismatchBanner';
import ErrorBoundary from './components/common/ErrorBoundary';
import { getLatestMoods } from './services/moods';
import { Shield, WifiOff } from 'lucide-react';

function AppContent() {
  const { user, isAuthorized, loading, partnerProfile } = useAuth();
  const {
    setupModalOpen,
    setSetupModalOpen,
    unlockModalOpen,
    setUnlockModalOpen,
    safetyModalOpen,
    setSafetyModalOpen
  } = useCrypto();

  const [activeTab, setActiveTab] = useState('chat');
  const [theme, setTheme] = useState('dark');
  const [isSearching, setIsSearching] = useState(false);
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [partnerMood, setPartnerMood] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Monitor online / offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for PWA install prompt
  useEffect(() => {
    const handlePrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  // Sync theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Mobile virtual keyboard detection for seamless chat viewport adjustment
  useEffect(() => {
    const handleViewportChange = () => {
      if (window.visualViewport) {
        const isKeyboardOpen = window.visualViewport.height < window.innerHeight - 100;
        document.body.classList.toggle('keyboard-visible', isKeyboardOpen);
      }
    };

    const handleFocusIn = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
        document.body.classList.add('keyboard-visible');
      }
    };

    const handleFocusOut = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
        setTimeout(() => {
          if (!document.activeElement || (document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'INPUT')) {
            document.body.classList.remove('keyboard-visible');
          }
        }, 100);
      }
    };

    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
      document.body.classList.remove('keyboard-visible');
    };
  }, []);

  // Load partner's latest mood
  useEffect(() => {
    if (user && isAuthorized) {
      loadPartnerMood();
    }
  }, [user, isAuthorized, partnerProfile]);

  const loadPartnerMood = async () => {
    try {
      const moods = await getLatestMoods();
      if (partnerProfile && moods[partnerProfile.id]) {
        setPartnerMood(moods[partnerProfile.id]);
      }
    } catch (e) {}
  };

  const handleToggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Splash Loading Screen
  if (loading) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-primary)',
          gap: '16px'
        }}
      >
        <div style={{ animation: 'pulseGlow 2.5s infinite ease-in-out' }}>
          <SaviourLogo size={58} variant="emblem" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', margin: 0 }}>The Saviour</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Entering your sanctuary...
          </p>
        </div>
      </div>
    );
  }

  // Not logged in -> Show Login
  if (!user) {
    return <Login />;
  }

  // Logged in but not in authorized 2-member list -> Show Unauthorized Guard
  if (!isAuthorized) {
    return <Unauthorized />;
  }

  // Authorized -> Render full private chat PWA application
  return (
    <ChatProvider>
      <div className="app-container">
        {/* Offline Warning Banner */}
        {!isOnline && (
          <div
            style={{
              padding: '6px 12px',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              zIndex: 100
            }}
          >
            <WifiOff size={13} />
            <span>You are currently offline. Messages will sync when connection returns.</span>
          </div>
        )}

        {/* Anti-Key Substitution Security Banner */}
        <KeyMismatchBanner />

        {/* Global App Header */}
        <Header
          activeTab={activeTab}
          onOpenMood={() => setShowMoodModal(true)}
          onToggleSearch={() => setIsSearching(prev => !prev)}
          isSearching={isSearching}
          partnerMood={partnerMood}
          installPrompt={Boolean(installPrompt)}
          onInstall={handleInstallApp}
        />

        {/* Main View Port */}
        <main className={`main-content ${activeTab === 'chat' ? 'chat-mode' : ''}`}>
          <ErrorBoundary>
            {activeTab === 'chat' && (
              <Chat
                isSearching={isSearching}
                onToggleSearch={() => setIsSearching(false)}
              />
            )}
            {activeTab === 'fun' && <Fun />}
            {activeTab === 'statistics' && <Statistics />}
            {activeTab === 'memories' && <Memories />}
            {activeTab === 'settings' && (
              <Settings
                theme={theme}
                onToggleTheme={handleToggleTheme}
                installPrompt={Boolean(installPrompt)}
                onInstall={handleInstallApp}
              />
            )}
          </ErrorBoundary>
        </main>

        {/* Bottom Navigation */}
        <BottomNav activeTab={activeTab} onSelectTab={setActiveTab} />

        {/* Mood Check-In Modal */}
        <MoodModal
          isOpen={showMoodModal}
          onClose={() => setShowMoodModal(false)}
          onMoodUpdated={loadPartnerMood}
        />

        {/* End-to-End Encryption Modals */}
        <E2EESetupModal
          isOpen={setupModalOpen}
          onClose={() => setSetupModalOpen(false)}
        />
        <E2EEUnlockModal
          isOpen={unlockModalOpen}
          onClose={() => setUnlockModalOpen(false)}
        />
        <SafetyNumberModal
          isOpen={safetyModalOpen}
          onClose={() => setSafetyModalOpen(false)}
        />
      </div>
    </ChatProvider>
  );
}

export default function App() {
  const [startupDismissed, setStartupDismissed] = useState(false);

  return (
    <AuthProvider>
      {!startupDismissed && (
        <StartupScreen onDismiss={() => setStartupDismissed(true)} />
      )}
      <CryptoProvider>
        <AppContent />
      </CryptoProvider>
    </AuthProvider>
  );
}
