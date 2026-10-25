import React from 'react';
import { ShieldAlert, LogOut, Copy, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Unauthorized() {
  const { user, logout } = useAuth();
  const [copied, setCopied] = React.useState(false);

  const handleCopyId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100%',
        padding: '24px 20px',
        backgroundColor: 'var(--bg-primary)',
        textAlign: 'center'
      }}
    >
      <div
        className="card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '36px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '18px'
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '2px solid rgba(239, 68, 68, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444'
          }}
        >
          <ShieldAlert size={36} />
        </div>

        <div>
          <h2 style={{ fontSize: '20px', color: 'var(--text-primary)' }}>Access Restricted</h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
            The Saviour is a private sanctuary strictly reserved for two authorized accounts. Your account (<strong>{user?.email}</strong>) has not been authorized.
          </p>
        </div>

        {/* User UUID Box for admin whitelisting */}
        <div
          style={{
            width: '100%',
            backgroundColor: 'var(--bg-input)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            border: '1px solid var(--border-subtle)',
            fontSize: '12px',
            textAlign: 'left'
          }}
        >
          <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px' }}>
            YOUR USER ID (FOR ADMIN WHITELISTING):
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <code style={{ color: 'var(--accent-cyan)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {user?.id}
            </code>
            <button
              onClick={handleCopyId}
              style={{
                background: 'none',
                border: 'none',
                color: copied ? '#10b981' : 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px'
              }}
              title="Copy User ID"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        <button
          onClick={logout}
          className="btn btn-secondary"
          style={{ width: '100%', padding: '12px', gap: '8px', marginTop: '10px' }}
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  );
}
