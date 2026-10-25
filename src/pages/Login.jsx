import React, { useState } from 'react';
import { Shield, Lock, Mail, ArrowRight, KeyRound, AlertCircle, Info, Sparkles } from 'lucide-react';
import SaviourLogo from '../components/common/SaviourLogo';
import { useAuth } from '../context/AuthContext';
import { resetPassword } from '../services/auth';

export default function Login() {
  const { login, configured, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [localError, setLocalError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);

    if (!email.trim()) {
      setLocalError('Please enter your email address.');
      return;
    }

    if (!resetMode && !password) {
      setLocalError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      if (resetMode) {
        await resetPassword(email);
        setResetSent(true);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setLocalError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setSubmitting(false);
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
        backgroundColor: 'var(--bg-primary)'
      }}
    >
      <div
        className="card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px'
        }}
      >
        {/* Sanctuary Brand Glyph */}
        <SaviourLogo size={58} variant="emblem" />

        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', color: 'var(--text-primary)', margin: 0 }}>The Saviour</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Private Sanctuary for Two
          </p>
        </div>

        {/* Configuration Notice if Supabase environment variables are missing */}
        {!configured && (
          <div
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
              fontSize: '12.5px',
              lineHeight: 1.4
            }}
          >
            <strong>Setup Required:</strong> Please configure your Supabase Project URL and Anon Key in your <code>.env</code> file to enable login.
          </div>
        )}

        {/* Error Feedback */}
        {(localError || authError) && (
          <div
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{localError || authError}</span>
          </div>
        )}

        {/* Reset Confirmation */}
        {resetSent ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ color: '#10b981', fontWeight: 600 }}>Password Reset Email Sent</div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              Check your inbox at <strong>{email}</strong> for instructions to reset your password.
            </p>
            <button
              onClick={() => { setResetMode(false); setResetSent(false); }}
              className="btn btn-secondary"
              style={{ marginTop: '8px' }}
            >
              Back to Login
            </button>
          </div>
        ) : (
          /* Login / Reset Form */
          <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Email field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Email Address
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px'
                }}
              >
                <Mail size={18} color="var(--text-muted)" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>

            {/* Password field */}
            {!resetMode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => { setResetMode(true); setLocalError(null); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-primary)',
                      fontSize: '11.5px',
                      cursor: 'pointer'
                    }}
                  >
                    Forgot?
                  </button>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px'
                  }}
                >
                  <Lock size={18} color="var(--text-muted)" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', marginTop: '6px' }}
            >
              {submitting ? (
                <span>Entering Sanctuary...</span>
              ) : resetMode ? (
                <>
                  <KeyRound size={16} />
                  <span>Send Reset Email</span>
                </>
              ) : (
                <>
                  <span>Enter Sanctuary</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Toggle back to login if in reset mode */}
            {resetMode && (
              <button
                type="button"
                onClick={() => { setResetMode(false); setLocalError(null); }}
                className="btn btn-ghost"
                style={{ fontSize: '13px', padding: '6px' }}
              >
                Back to Sign In
              </button>
            )}
          </form>
        )}

        {/* Private Access Notice */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            fontSize: '11.5px',
            color: 'var(--text-muted)',
            textAlign: 'left',
            marginTop: '8px'
          }}
        >
          <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            This application is strictly restricted to the 2 authorized sanctuary accounts. Public registration is permanently disabled.
          </span>
        </div>
      </div>
    </div>
  );
}
