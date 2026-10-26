import React, { useState } from 'react';
import {
  User,
  Moon,
  Sun,
  Flame,
  Bell,
  Calendar,
  Smartphone,
  ShieldCheck,
  Shield,
  ShieldAlert,
  Key,
  KeyRound,
  Lock,
  FileDown,
  FileUp,
  LogOut,
  Save,
  Check,
  Info,
  Download
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCrypto } from '../context/CryptoContext';
import { updateProfile } from '../services/auth';
import Avatar from '../components/common/Avatar';
import SpecialEvents from './SpecialEvents';

export default function Settings({ theme, onToggleTheme, installPrompt, onInstall }) {
  const { user, profile, partnerProfile, logout, refreshProfile } = useAuth();
  const {
    cryptoState,
    isPartnerVerified,
    setSafetyModalOpen,
    setSetupModalOpen,
    downloadOfflineBackup,
    restoreFromOfflineFile
  } = useCrypto();

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [showBackupPrompt, setShowBackupPrompt] = useState(false);
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [backupError, setBackupError] = useState(null);
  const [backupSuccess, setBackupSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [restoreFileContent, setRestoreFileContent] = useState('');
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [restoreError, setRestoreError] = useState(null);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [statusMessage, setStatusMessage] = useState(profile?.status_message || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [streaksEnabled, setStreaksEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('23:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('07:00');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showEventsModal, setShowEventsModal] = useState(false);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user || savingProfile) return;

    setSavingProfile(true);
    try {
      await updateProfile(user.id, {
        displayName: displayName.trim(),
        avatarUrl: avatarUrl.trim(),
        statusMessage: statusMessage.trim()
      });
      await refreshProfile();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRequestNotification = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
      } else {
        alert('Notification permission was declined in your browser settings.');
      }
    } else {
      alert('Notifications are not supported in this browser.');
    }
  };

  const handleDownloadOfflineBackup = async (e) => {
    e.preventDefault();
    if (!backupPassphrase || isExporting) return;
    setIsExporting(true);
    setBackupError(null);
    try {
      await downloadOfflineBackup(backupPassphrase);
      setBackupSuccess(true);
      setShowBackupPrompt(false);
      setBackupPassphrase('');
      setTimeout(() => setBackupSuccess(false), 3000);
    } catch (err) {
      setBackupError(err.message || 'Failed to export backup file.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestoreFile = async (e) => {
    e.preventDefault();
    if (!restoreFileContent || !restorePassphrase || isRestoring) return;
    setIsRestoring(true);
    setRestoreError(null);
    try {
      await restoreFromOfflineFile(restoreFileContent, restorePassphrase);
      setRestoreSuccess(true);
      setShowRestorePrompt(false);
      setRestoreFileContent('');
      setRestorePassphrase('');
      setTimeout(() => setRestoreSuccess(false), 5000);
    } catch (err) {
      setRestoreError(err.message || 'Failed to restore backup file.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setRestoreFileContent(event.target?.result || '');
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
      {/* Settings Title */}
      <div>
        <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', margin: 0 }}>Sanctuary Settings</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Preferences & Account</p>
      </div>

      {/* Profile Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Avatar
            src={avatarUrl || profile?.avatar_url}
            name={displayName || profile?.display_name || 'User'}
            size={56}
          />
          <div>
            <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', margin: 0 }}>
              {profile?.display_name || 'My Profile'}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your sanctuary name"
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '13.5px',
                marginTop: '4px',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Status Note
            </label>
            <input
              type="text"
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              placeholder="e.g. Thinking of you always..."
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '13.5px',
                marginTop: '4px',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Avatar URL (Optional)
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '13.5px',
                marginTop: '4px',
                outline: 'none'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="btn btn-primary"
            style={{ padding: '10px', fontSize: '13px', marginTop: '4px' }}
          >
            {savingProfile ? 'Updating...' : savedSuccess ? (
              <>
                <Check size={16} /> Saved Successfully
              </>
            ) : (
              <>
                <Save size={15} /> Save Profile Changes
              </>
            )}
          </button>
        </form>
      </div>

      {/* Special Days & Countdowns Entry */}
      <div
        onClick={() => setShowEventsModal(true)}
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          cursor: 'pointer'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)'
            }}
          >
            <Calendar size={18} />
          </div>
          <div>
            <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Special-Day Countdowns
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              Manage anniversaries, birthdays & trips
            </div>
          </div>
        </div>
        <span className="badge badge-purple">Manage</span>
      </div>

      {/* Appearance & Theme Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Appearance
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {theme === 'dark' ? <Moon size={18} color="var(--accent-primary)" /> : <Sun size={18} color="#f59e0b" />}
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {theme === 'dark' ? 'Dark Obsidian Theme' : 'Light Theme'}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Tailored for low-light intimate sanctuary
              </div>
            </div>
          </div>
          <button
            onClick={onToggleTheme}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            Toggle {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>

      {/* Preferences & Notifications */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Preferences & Habits
        </div>

        {/* Streaks toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Flame size={18} color="#f59e0b" />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Chat Streaks
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Count consecutive days of connection
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={streaksEnabled}
            onChange={(e) => setStreaksEnabled(e.target.checked)}
            style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
          />
        </div>

        {/* In-App Notifications & Quiet Hours */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bell size={18} color="var(--accent-warm)" />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Web Notifications
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Generic alerts ("New message in sanctuary")
              </div>
            </div>
          </div>
          <button
            onClick={handleRequestNotification}
            className="btn btn-secondary"
            style={{ padding: '5px 10px', fontSize: '11px' }}
          >
            {notificationsEnabled ? 'Enabled' : 'Request'}
          </button>
        </div>

        {/* Quiet hours */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Quiet Hours Window:</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="time"
              value={quietHoursStart}
              onChange={(e) => setQuietHoursStart(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '3px 6px',
                color: 'var(--text-primary)',
                fontSize: '11.5px'
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>to</span>
            <input
              type="time"
              value={quietHoursEnd}
              onChange={(e) => setQuietHoursEnd(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '3px 6px',
                color: 'var(--text-primary)',
                fontSize: '11.5px'
              }}
            />
          </div>
        </div>
      </div>

      {/* PWA Installation Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Smartphone size={18} color="var(--accent-primary)" />
          <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Install as Mobile App (PWA)
          </div>
        </div>

        <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          The Saviour runs full-screen like a native mobile app without downloading from an app store:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <div>
            📱 <strong>iPhone (Safari):</strong> Tap the <em>Share icon</em> (square with arrow) → select <em>"Add to Home Screen"</em>.
          </div>
          <div>
            🤖 <strong>Android (Chrome):</strong> Tap the <em>Three dots menu</em> → select <em>"Install App"</em> or tap below.
          </div>
        </div>

        {installPrompt && (
          <button
            onClick={onInstall}
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px', fontSize: '13px', gap: '6px', marginTop: '4px' }}
          >
            <Download size={15} /> Install The Saviour App
          </button>
        )}
      </div>

      {/* End-to-End Encryption (E2EE) Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} color={isPartnerVerified ? '#10b981' : cryptoState === 'key_mismatch' ? '#ef4444' : 'var(--accent-primary)'} />
            <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
              End-to-End Encryption
            </div>
          </div>
          <span
            style={{
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '6px',
              fontWeight: 600,
              backgroundColor: isPartnerVerified ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              color: isPartnerVerified ? '#10b981' : '#f59e0b',
              border: `1px solid ${isPartnerVerified ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
            }}
          >
            {isPartnerVerified ? 'Verified' : cryptoState === 'ready' ? 'Active (Unverified)' : cryptoState}
          </span>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
          Your sanctuary uses hardware-accelerated ECDH P-256 and authenticated AES-256-GCM. Messages and photos can only be decrypted on authorized devices.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
          {/* Compare Safety Number Action */}
          <button
            type="button"
            onClick={() => setSafetyModalOpen(true)}
            className="btn btn-secondary"
            style={{ width: '100%', padding: '10px 14px', fontSize: '12.5px', justifyContent: 'space-between' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <KeyRound size={15} color="var(--accent-cyan)" />
              <span>Verify Safety Number</span>
            </div>
            <span style={{ fontSize: '11px', opacity: 0.8 }}>Compare digits →</span>
          </button>

          {/* Backup Key with Passphrase */}
          <button
            type="button"
            onClick={() => setSetupModalOpen(true)}
            className="btn btn-secondary"
            style={{ width: '100%', padding: '10px 14px', fontSize: '12.5px', justifyContent: 'space-between' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={15} color="var(--accent-warm)" />
              <span>Backup Key with Passphrase</span>
            </div>
            <span style={{ fontSize: '11px', opacity: 0.8 }}>Remote Vault →</span>
          </button>

          {/* Export Offline Backup */}
          {!showBackupPrompt ? (
            <button
              type="button"
              onClick={() => setShowBackupPrompt(true)}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '10px 14px', fontSize: '12.5px', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileDown size={15} color="var(--accent-primary)" />
                <span>Download Offline Key Backup</span>
              </div>
              <span style={{ fontSize: '11px', opacity: 0.8 }}>.saviour-backup</span>
            </button>
          ) : (
            <form onSubmit={handleDownloadOfflineBackup} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', backgroundColor: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                Enter your Sanctuary Passphrase to encrypt your downloadable backup file:
              </div>
              <input
                type="password"
                value={backupPassphrase}
                onChange={(e) => setBackupPassphrase(e.target.value)}
                placeholder="Sanctuary Passphrase..."
                required
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px',
                  outline: 'none'
                }}
              />
              {backupError && (
                <div style={{ fontSize: '11.5px', color: '#f87171' }}>{backupError}</div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowBackupPrompt(false)}
                  className="btn-ghost"
                  style={{ flex: 1, padding: '6px', fontSize: '11.5px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isExporting || !backupPassphrase}
                  className="btn btn-primary"
                  style={{ flex: 2, padding: '6px', fontSize: '11.5px' }}
                >
                  {isExporting ? 'Exporting...' : 'Save File'}
                </button>
              </div>
            </form>
          )}

          {backupSuccess && (
            <div style={{ fontSize: '11.5px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Check size={13} />
              <span>Offline key backup downloaded successfully!</span>
            </div>
          )}

          {/* Restore Offline Backup File */}
          {!showRestorePrompt ? (
            <button
              type="button"
              onClick={() => setShowRestorePrompt(true)}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '10px 14px', fontSize: '12.5px', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileUp size={15} color="var(--accent-cyan)" />
                <span>Restore Key from Backup File</span>
              </div>
              <span style={{ fontSize: '11px', opacity: 0.8 }}>.saviour-backup</span>
            </button>
          ) : (
            <form onSubmit={handleRestoreFile} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', backgroundColor: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                Select your <code>.saviour-backup</code> file and enter its passphrase:
              </div>
              <input
                type="file"
                accept=".saviour-backup,.json"
                onChange={handleFileChange}
                required
                style={{ fontSize: '11.5px', color: 'var(--text-primary)' }}
              />
              <input
                type="password"
                value={restorePassphrase}
                onChange={(e) => setRestorePassphrase(e.target.value)}
                placeholder="Backup Passphrase..."
                required
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px',
                  outline: 'none'
                }}
              />
              {restoreError && (
                <div style={{ fontSize: '11.5px', color: '#f87171' }}>{restoreError}</div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowRestorePrompt(false)}
                  className="btn-ghost"
                  style={{ flex: 1, padding: '6px', fontSize: '11.5px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRestoring || !restoreFileContent || !restorePassphrase}
                  className="btn btn-primary"
                  style={{ flex: 2, padding: '6px', fontSize: '11.5px' }}
                >
                  {isRestoring ? 'Restoring...' : 'Restore Key & Chats'}
                </button>
              </div>
            </form>
          )}

          {restoreSuccess && (
            <div style={{ fontSize: '11.5px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Check size={13} />
              <span>Key restored! Chats will now decrypt automatically.</span>
            </div>
          )}

          {/* Re-run setup / Re-encrypt vault */}
          <button
            type="button"
            onClick={() => setSetupModalOpen(true)}
            className="btn-ghost"
            style={{ width: '100%', padding: '6px', fontSize: '11.5px', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            Re-run E2EE Setup or Change Passphrase
          </button>
        </div>
      </div>

      {/* Security & RLS Verification Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={18} color="#10b981" />
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Security & Privacy Guarantee
          </div>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <p>• <strong>Strict 2-User Boundary:</strong> PostgreSQL Row Level Security (RLS) ensures only the 2 authorized sanctuary accounts can query or write data.</p>
          <p>• <strong>Zero Third-Party Leaks:</strong> Photos reside in a private Supabase Storage bucket with 1-hour signed tokens, not public CDN URLs.</p>
          <p>• <strong>Service Role Protection:</strong> No admin or service-role keys exist in frontend code.</p>
        </div>
      </div>

      {/* Logout button */}
      <button
        onClick={logout}
        className="btn btn-secondary"
        style={{ width: '100%', padding: '12px', gap: '8px', color: '#f87171' }}
      >
        <LogOut size={16} /> Sign Out of Sanctuary
      </button>

      {/* Special Events Modal */}
      <SpecialEvents
        isOpen={showEventsModal}
        onClose={() => setShowEventsModal(false)}
      />
    </div>
  );
}
