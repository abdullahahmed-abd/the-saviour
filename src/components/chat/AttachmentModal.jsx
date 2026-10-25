import React, { useState, useEffect } from 'react';
import { Send, X, AlertCircle } from 'lucide-react';
import Modal from '../common/Modal';
import { useChat } from '../../context/ChatContext';

export default function AttachmentModal({ file, isOpen, onClose }) {
  const { sendPhotoMessage, uploadingPhoto, uploadError } = useChat();
  const [caption, setCaption] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

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
          style={{
            width: '100%',
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            outline: 'none'
          }}
        />

        {/* Send Action */}
        <button
          onClick={handleSend}
          disabled={uploadingPhoto}
          className="btn btn-primary"
          style={{ width: '100%', padding: '12px' }}
        >
          {uploadingPhoto ? (
            <span>Encrypting & Uploading...</span>
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
