import React, { useState } from 'react';
import { Lock, Key, Upload, AlertCircle, FileText } from 'lucide-react';
import Modal from '../common/Modal';
import { useCrypto } from '../../context/CryptoContext';

export default function E2EEUnlockModal({ isOpen, onClose }) {
  const { unlockE2EE, restoreFromOfflineFile, isProcessing, passphraseError, setPassphraseError } = useCrypto();

  const [mode, setMode] = useState('passphrase'); // 'passphrase' | 'file'
  const [passphrase, setPassphrase] = useState('');
  const [offlineFileContent, setOfflineFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [localError, setLocalError] = useState(null);

  const handleUnlock = async (e) => {
    e.preventDefault();
    setLocalError(null);
    setPassphraseError(null);

    try {
      if (mode === 'passphrase') {
        await unlockE2EE(passphrase);
      } else {
        if (!offlineFileContent) {
          setLocalError('Please choose a valid .saviour-backup file');
          return;
        }
        await restoreFromOfflineFile(offlineFileContent, passphrase);
      }
      onClose();
    } catch (err) {
      setLocalError(err.message || 'Decryption failed. Please check your credentials.');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setOfflineFileContent(event.target.result);
    };
    reader.readAsText(file);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Unlock Your Private Sanctuary 🔐">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Notice */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '12px',
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            color: 'var(--text-secondary)',
            fontSize: '12.5px',
            lineHeight: 1.45
          }}
        >
          <strong style={{ color: 'var(--accent-cyan)' }}>New Device Detected:</strong>
          <br />
          Your encrypted identity keys are safely backed up. Enter your Sanctuary Passphrase to decrypt and restore your private key on this device.
        </div>

        {/* Mode Selector Tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
          <button
            type="button"
            onClick={() => setMode('passphrase')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              background: mode === 'passphrase' ? 'var(--accent-primary)' : 'transparent',
              color: mode === 'passphrase' ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Enter Passphrase
          </button>
          <button
            type="button"
            onClick={() => setMode('file')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              background: mode === 'file' ? 'var(--accent-primary)' : 'transparent',
              color: mode === 'file' ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Load Backup File
          </button>
        </div>

        <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {mode === 'file' && (
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px', display: 'block' }}>
                Select Your .saviour-backup File
              </label>
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px dashed var(--border-subtle)',
                  cursor: 'pointer',
                  backgroundColor: 'var(--bg-input)',
                  gap: '6px'
                }}
              >
                <Upload size={20} color="var(--accent-primary)" />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {fileName || 'Tap to choose backup JSON file'}
                </span>
                <input
                  type="file"
                  accept=".json,.saviour-backup"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          )}

          <div>
            <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={14} color="var(--accent-primary)" />
              {mode === 'passphrase' ? 'Sanctuary Passphrase' : 'Password for Backup File'}
            </label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter your private passphrase..."
              required
              autoFocus
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

          {/* Error Message */}
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing || !passphrase}
              className="btn btn-primary"
              style={{ flex: 2, padding: '12px' }}
            >
              {isProcessing ? 'Decrypting Key Vault...' : 'Unlock Sanctuary 🔓'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
