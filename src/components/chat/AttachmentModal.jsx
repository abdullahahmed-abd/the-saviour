import React, { useState, useEffect } from 'react';
import { Send, X, AlertCircle, Lock } from 'lucide-react';
import Modal from '../common/Modal';
import { useChat } from '../../context/ChatContext';
import { useCrypto } from '../../context/CryptoContext';

export default function AttachmentModal({ file, isOpen, onClose }) {
  const { sendPhotoMessage, uploadingPhoto, uploadError } = useChat();
  const { cryptoState, conversationKey, setUnlockModalOpen, setSetupModalOpen } = useCrypto();
  const [caption, setCaption] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  const isKeyReady = cryptoState === 'ready' && Boolean(conversationKey);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl('');
    }
  }, [file]);

  const handleSend = async () => {
    if (!file || uploadingPhoto) return;
    if (!isKeyReady) {
      if (cryptoState === 'locked') setUnlockModalOpen(true);
      else if (cryptoState === 'uninitialized') setSetupModalOpen(true);
      return;
    }
    try {
      await sendPhotoMessage(file, caption);
      setCaption('');
      onClose();
    } catch (err) {
      // Error handled by context uploadError state
    }
  };

  if (!file) return null;

  const fileSizeKB = Math.round(file.size / 1024);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send Private Photo 📸">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Image Preview Box */}
        <div
          style={{
            maxHeight: '300px',
            borderRadius: '16px',
            overflow: 'hidden',
            backgroundColor: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border-subtle)'
          }}
        >
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Upload Preview"
              style={{ maxHeight: '300px', width: 'auto', maxWidth: '100%', objectFit: 'contain' }}
            />
          )}
        </div>

        {/* File info badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span>{file.name}</span>
          <span>{fileSizeKB > 1024 ? `${(fileSizeKB / 1024).toFixed(1)} MB` : `${fileSizeKB} KB`} • Auto-compressed</span>
        </div>

        {/* Encryption security alert if keys are not ready */}
        {!isKeyReady && (
          <div
            style={{
              padding: '12px',
              borderRadius: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <Lock size={15} />
              <span>Encryption Required — Upload Blocked</span>
            </div>
            <div style={{ opacity: 0.9 }}>
              {cryptoState === 'locked'
                ? 'Your encryption vault is locked. Unlock it to encrypt and send photos.'
                : cryptoState === 'uninitialized'
                ? 'End-to-End Encryption setup is required before sending photos.'
                : cryptoState === 'key_mismatch'
                ? 'Partner encryption key changed. Verification required.'
                : 'Waiting for partner public keys.'}
            </div>
            {(cryptoState === 'locked' || cryptoState === 'uninitialized') && (
              <button
                type="button"
                onClick={() => {
                  if (cryptoState === 'locked') setUnlockModalOpen(true);
                  else if (cryptoState === 'uninitialized') setSetupModalOpen(true);
                }}
                style={{
                  marginTop: '4px',
                  padding: '6px 12px',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '11px',
                  alignSelf: 'flex-start'
                }}
              >
                {cryptoState === 'locked' ? 'Unlock Vault' : 'Setup Encryption'}
              </button>
            )}
          </div>
        )}

        {/* Error message */}
        {uploadError && (
          <div
            style={{
              padding: '10px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <AlertCircle size={16} />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Optional Caption Input */}
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add an optional caption..."
          disabled={!isKeyReady}
          style={{
            width: '100%',
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            outline: 'none',
            opacity: isKeyReady ? 1 : 0.6
          }}
        />

        {/* Send Action */}
        <button
          onClick={handleSend}
          disabled={uploadingPhoto || !isKeyReady}
          className="btn btn-primary"
          style={{
            width: '100%',
            padding: '12px',
            opacity: (!isKeyReady || uploadingPhoto) ? 0.5 : 1,
            cursor: (!isKeyReady || uploadingPhoto) ? 'not-allowed' : 'pointer'
          }}
        >
          {uploadingPhoto ? (
            <span>Encrypting & Uploading...</span>
          ) : !isKeyReady ? (
            <>
              <Lock size={16} />
              <span>Unlock to Send Photo</span>
            </>
          ) : (
            <>
              <Send size={16} />
              <span>Send Private Photo</span>
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}
