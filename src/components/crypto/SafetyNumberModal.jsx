import React, { useState } from 'react';
import { Shield, ShieldCheck, ShieldAlert, Copy, Check, Info } from 'lucide-react';
import Modal from '../common/Modal';
import { useCrypto } from '../../context/CryptoContext';
import { useAuth } from '../../context/AuthContext';

export default function SafetyNumberModal({ isOpen, onClose }) {
  const { safetyNumber, isPartnerVerified, verifyPartnerSafetyNumber, unverifyPartnerSafetyNumber } = useCrypto();
  const { partnerProfile } = useAuth();

  const [copied, setCopied] = useState(false);
  const [viewHex, setViewHex] = useState(false);

  const partnerName = partnerProfile?.display_name || 'your partner';

  const handleCopy = () => {
    if (!safetyNumber) return;
    const textToCopy = viewHex ? safetyNumber.hexFormatted : safetyNumber.decimalFormatted;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Safety Number Verification 🛡️">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Verification Status Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: '14px',
            backgroundColor: isPartnerVerified ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
            border: `1px solid ${isPartnerVerified ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isPartnerVerified ? (
              <ShieldCheck size={22} color="#10b981" />
            ) : (
              <ShieldAlert size={22} color="#f59e0b" />
            )}
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: isPartnerVerified ? '#10b981' : '#f59e0b' }}>
                {isPartnerVerified ? 'Verified Sanctuary Key' : 'Unverified Identity Key'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {isPartnerVerified
                  ? `You have verified the Safety Number with ${partnerName}`
                  : 'Compare numbers out-of-band to guarantee anti-interception'}
              </div>
            </div>
          </div>
        </div>

        {/* Instructions Card */}
        <div
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            padding: '10px 14px',
            borderRadius: '10px',
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Info size={14} color="var(--accent-primary)" />
            How to verify your end-to-end encryption:
          </div>
          Compare the digits below with <strong>{partnerName}</strong> through an independent channel (such as <em>in person</em> or on a <em>phone call</em>). If both screens show the exact same number, your sanctuary is 100% private and protected from key substitution.
        </div>

        {/* Formatted Safety Number Box */}
        {safetyNumber ? (
          <div
            style={{
              padding: '16px',
              borderRadius: '16px',
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <div
              style={{
                fontFamily: 'monospace, "Courier New", Courier',
                fontSize: viewHex ? '13px' : '15px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                lineHeight: 1.7,
                textAlign: 'center',
                color: 'var(--text-primary)',
                wordBreak: 'break-word',
                userSelect: 'all',
                maxWidth: '100%'
              }}
            >
              {viewHex ? (
                safetyNumber.hexFormatted
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 14px' }}>
                  {safetyNumber.decimalFormatted.split(' ').map((chunk, idx) => (
                    <span key={idx} style={{ padding: '2px 4px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                      {chunk}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Toggle Hex vs Decimal and Copy */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
              <button
                type="button"
                onClick={() => setViewHex(h => !h)}
                className="btn-ghost"
                style={{ fontSize: '11px', color: 'var(--accent-cyan)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
              >
                {viewHex ? 'Show 60-Digit Signal Format' : 'Show Hexadecimal Fingerprint'}
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '11.5px', gap: '6px' }}
              >
                {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Safety Number will appear once both you and your partner have initialized your sanctuary keys.
          </div>
        )}

        {/* Verification Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
          {isPartnerVerified ? (
            <button
              type="button"
              onClick={unverifyPartnerSafetyNumber}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '12px', color: '#f87171' }}
            >
              Clear Verification Status
            </button>
          ) : (
            <button
              type="button"
              disabled={!safetyNumber}
              onClick={verifyPartnerSafetyNumber}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', gap: '8px' }}
            >
              <ShieldCheck size={18} />
              <span>Mark as Verified Out-of-Band</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
