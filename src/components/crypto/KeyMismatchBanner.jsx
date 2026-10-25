import React from 'react';
import { ShieldAlert, RefreshCw, KeyRound } from 'lucide-react';
import { useCrypto } from '../../context/CryptoContext';

export default function KeyMismatchBanner() {
  const { cryptoState, keyMismatchDetails, setSafetyModalOpen, acceptNewPartnerKey } = useCrypto();

  if (cryptoState !== 'key_mismatch' || !keyMismatchDetails) {
    return null;
  }

  return (
    <div
      className="animate-slide-up"
      style={{
        margin: '12px 16px',
        padding: '16px',
        borderRadius: '16px',
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        border: '1px solid rgba(239, 68, 68, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 4px 20px rgba(239, 68, 68, 0.15)',
        zIndex: 40
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div
          style={{
            padding: '8px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <ShieldAlert size={22} />
        </div>

        <div>
          <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#f87171', margin: 0 }}>
            Security Warning: Partner's Identity Key Has Changed
          </h4>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.45 }}>
            Your partner's cryptographic key does not match your pinned record. This can happen if they reinstalled the app or switched devices, but it could also indicate an interception attempt.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
        <button
          type="button"
          onClick={() => setSafetyModalOpen(true)}
          className="btn btn-secondary"
          style={{ flex: 1, padding: '9px 12px', fontSize: '12.5px', gap: '6px' }}
        >
          <KeyRound size={14} />
          <span>Compare Safety Number</span>
        </button>

        <button
          type="button"
          onClick={acceptNewPartnerKey}
          className="btn"
          style={{
            flex: 1,
            padding: '9px 12px',
            fontSize: '12.5px',
            backgroundColor: '#ef4444',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <RefreshCw size={14} />
          <span>Accept New Key</span>
        </button>
      </div>
    </div>
  );
}
