import React from 'react';
import { Shield, ShieldCheck, ShieldAlert, Search, Smile, Sparkles, Download } from 'lucide-react';
import Avatar from '../common/Avatar';
import SaviourLogo from '../common/SaviourLogo';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useCrypto } from '../../context/CryptoContext';

export default function Header({
  activeTab,
  onOpenMood,
  onToggleSearch,
  isSearching,
  partnerMood,
  installPrompt,
  onInstall
}) {
  const { partnerProfile } = useAuth();
  const { partnerTyping, partnerOnline } = useChat();
  const { cryptoState, isPartnerVerified, setSafetyModalOpen, setSetupModalOpen } = useCrypto();

  const partnerName = partnerProfile?.display_name || 'My Sanctuary';

  return (
    <header className="app-header">
      {/* Brand logo & active screen */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <SaviourLogo variant="emblem" size={30} />
        <div>
          <h1 style={{ fontSize: '17px', fontWeight: 700, margin: 0, lineHeight: 1.1, color: 'var(--text-primary)' }}>
            The Saviour
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            {partnerTyping ? (
              <span style={{ fontSize: '11px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                Typing
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </span>
            ) : partnerOnline ? (
              <span style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                Online with you
              </span>
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Private 2-person sanctuary
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {/* E2EE Shield status icon */}
        <button
          onClick={() => {
            if (cryptoState === 'uninitialized') {
              setSetupModalOpen(true);
            } else {
              setSafetyModalOpen(true);
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: '6px',
            borderRadius: '50%',
            cursor: 'pointer',
            color: isPartnerVerified ? '#10b981' : cryptoState === 'key_mismatch' ? '#ef4444' : 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title={
            isPartnerVerified
              ? 'End-to-End Encrypted (Safety Number Verified)'
              : cryptoState === 'key_mismatch'
              ? 'Warning: Partner Key Mismatch'
              : 'End-to-End Encrypted (Tap to view Safety Number)'
          }
        >
          {isPartnerVerified ? (
            <ShieldCheck size={18} />
          ) : cryptoState === 'key_mismatch' ? (
            <ShieldAlert size={18} />
          ) : (
            <Shield size={18} />
          )}
        </button>
        {/* PWA Install Button if available */}
        {installPrompt && (
          <button
            onClick={onInstall}
            className="btn badge-purple"
            style={{ padding: '6px 10px', fontSize: '12px', border: 'none', cursor: 'pointer' }}
            title="Install The Saviour to Home Screen"
          >
            <Download size={13} />
            Install
          </button>
        )}

        {/* Mood Check-in Pill */}
        <button
          onClick={onOpenMood}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-full)',
            padding: '5px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            fontSize: '12px'
          }}
          title="Mood Check-in"
        >
          {partnerMood ? (
            <>
              <span style={{ fontSize: '14px' }}>{partnerMood.emoji}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{partnerMood.mood}</span>
            </>
          ) : (
            <>
              <Smile size={14} color="var(--accent-warm)" />
              <span style={{ fontSize: '11px' }}>Mood</span>
            </>
          )}
        </button>

        {/* Search button (Chat tab) */}
        {activeTab === 'chat' && (
          <button
            onClick={onToggleSearch}
            className="btn-ghost"
            style={{
              padding: '7px',
              borderRadius: '50%',
              border: 'none',
              background: isSearching ? 'var(--accent-glow)' : 'transparent',
              color: isSearching ? 'var(--accent-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Search Messages"
          >
            <Search size={18} />
          </button>
        )}

        {/* Partner Avatar display */}
        {partnerProfile && (
          <Avatar
            src={partnerProfile.avatar_url}
            name={partnerProfile.display_name}
            size={32}
            online={partnerOnline}
          />
        )}
      </div>
    </header>
  );
}
