import React, { useState } from 'react';
import SaviourLogo from '../common/SaviourLogo';

/**
 * The Saviour — Cinematic Black Startup Screen
 * 
 * Requirements:
 * - Pure black background (#000000) with restrained ambient electric-blue lighting.
 * - Perfectly centered vertically and horizontally.
 * - The ONLY clickable element is the "THE SAVIOUR" logo/branding area.
 * - On click, smoothly fades out to reveal the underlying application (Login or Chat).
 * - Exact text content:
 *     THE SAVIOUR
 *     SYSTEM UPDATE IN PROGRESS
 *     We're Preparing Something Better
 *     The app is currently undergoing scheduled maintenance. Some features may be temporarily unavailable.
 * - Zero extra buttons, links, or progress bars.
 * - In-memory dismissed state (never persisted to storage).
 */
export default function StartupScreen({ onDismiss }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleTriggerDismiss = () => {
    if (isExiting) return;
    setIsExiting(true);
    // Smooth fade-out duration
    setTimeout(() => {
      onDismiss();
    }, 450);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTriggerDismiss();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: '#000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
        overflow: 'hidden',
        userSelect: 'none',
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? 'scale(0.985)' : 'scale(1)',
        transition: 'opacity 0.45s cubic-bezier(0.4, 0, 0.2, 1), transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: isExiting ? 'none' : 'auto'
      }}
    >
      {/* Restrained cinematic ambient blue background aura */}
      <div
        style={{
          position: 'absolute',
          top: '36%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '560px',
          height: '560px',
          background: 'radial-gradient(circle, rgba(14, 42, 71, 0.28) 0%, rgba(2, 6, 14, 0.6) 50%, rgba(0, 0, 0, 0) 75%)',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* Main Centered Content Container */}
      <div
        className="animate-startup-fade-in"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '520px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}
      >
        {/* Sole Clickable Element: The Saviour Branding Area */}
        <div
          role="button"
          tabIndex={0}
          aria-label="The Saviour — Authenticate to proceed"
          onClick={handleTriggerDismiss}
          onKeyDown={handleKeyDown}
          className="saviour-branding-target"
          style={{
            cursor: 'pointer',
            padding: '16px 24px',
            borderRadius: '20px',
            transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), filter 0.3s ease',
            outline: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <SaviourLogo size={80} variant="full" />
        </div>

        {/* System Status Subtitle */}
        <div
          style={{
            marginTop: '16px',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.28em',
            textIndent: '0.28em',
            textTransform: 'uppercase',
            color: '#475569',
            fontFamily: "'Inter', sans-serif"
          }}
        >
          SYSTEM UPDATE IN PROGRESS
        </div>

        {/* Subtle Horizontal Divider Line */}
        <div
          style={{
            width: '48px',
            height: '1px',
            backgroundColor: 'rgba(56, 189, 248, 0.25)',
            margin: '44px 0 28px 0'
          }}
        />

        {/* Main Heading */}
        <h2
          style={{
            fontSize: '26px',
            fontWeight: 500,
            color: '#f1f5f9',
            margin: 0,
            fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
            letterSpacing: '-0.015em',
            lineHeight: 1.25
          }}
        >
          We're Preparing Something Better
        </h2>

        {/* Maintenance Message */}
        <p
          style={{
            fontSize: '14px',
            color: '#64748b',
            lineHeight: 1.65,
            marginTop: '14px',
            marginBottom: 0,
            maxWidth: '430px',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 400
          }}
        >
          The app is currently undergoing scheduled maintenance. Some features may be temporarily unavailable.
        </p>
      </div>
    </div>
  );
}
