import React, { useState } from 'react';
import { Shield, Key, Lock, Eye, EyeOff, AlertCircle, CheckCircle, Info } from 'lucide-react';
import Modal from '../common/Modal';
import { useCrypto } from '../../context/CryptoContext';
import { evaluatePassphraseStrength } from '../../services/crypto';

export default function E2EESetupModal({ isOpen, onClose }) {
  const { setupE2EE, isProcessing, passphraseError, setPassphraseError } = useCrypto();

  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState(null);

  const strength = evaluatePassphraseStrength(passphrase);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    setPassphraseError(null);

    if (passphrase !== confirmPassphrase) {
      setLocalError('Passphrases do not match. Please re-enter.');
      return;
    }

    if (!strength.isStrong) {
      setLocalError('Please choose a stronger passphrase (min 10 characters with mixed letters/numbers/symbols or 4+ words).');
      return;
    }

    try {
      await setupE2EE(passphrase);
      onClose();
    } catch (err) {
      setLocalError(err.message || 'Failed to initialize E2EE keys.');
    }
  };

  const getMeterColor = (score) => {
    if (score >= 6) return '#10b981'; // Green
    if (score >= 4) return '#38bdf8'; // Cyan
    if (score >= 2) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Initialize End-to-End Encryption 🛡️">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Educational Hero Banner */}
        <div
          style={{
            padding: '14px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(56, 189, 248, 0.1))',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start'
          }}
        >
          <div
            style={{
              padding: '8px',
              borderRadius: '50%',
              backgroundColor: 'rgba(124, 58, 237, 0.25)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Shield size={20} />
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>True Zero-Knowledge Sanctuary:</span>
            <br />
            Messages and photos will be encrypted directly on your device. Neither the application developer nor the database administrator can ever read your private conversations.
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={14} color="var(--accent-primary)" />
              Create Your Sanctuary Passphrase
            </label>
            <div style={{ position: 'relative', marginTop: '6px' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="e.g. My-Unbreakable-Secret-Sanctuary-2026!"
                required
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 42px 12px 14px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Strength Meter */}
            {passphrase && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: getMeterColor(strength.score), fontWeight: 600 }}>
                    {strength.feedback}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>Score: {strength.score}/7</span>
                </div>
                <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, (strength.score / 7) * 100)}%`,
                      backgroundColor: getMeterColor(strength.score),
                      transition: 'width 0.25s ease'
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={14} color="var(--accent-primary)" />
              Confirm Sanctuary Passphrase
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
              placeholder="Confirm your passphrase..."
              required
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                marginTop: '6px',
                outline: 'none'
              }}
            />
          </div>

          {/* Recovery Warning Notice */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              fontSize: '11.5px',
              color: '#fbbf24',
              display: 'flex',
              gap: '8px',
              lineHeight: 1.45
            }}
          >
            <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Important:</strong> There is no master reset key. If you ever switch devices or clear your browser data, you will need this passphrase to unlock your private chat history.
            </div>
          </div>

          {/* Error Message Display */}
          {(localError || passphraseError) && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertCircle size={16} />
              <span>{localError || passphraseError}</span>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '12px' }}
            >
              Decide Later
            </button>
            <button
              type="submit"
              disabled={isProcessing || !passphrase || !confirmPassphrase}
              className="btn btn-primary"
              style={{ flex: 2, padding: '12px' }}
            >
              {isProcessing ? 'Generating Keys (PBKDF2)...' : 'Initialize Sanctuary 🔒'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
