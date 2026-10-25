import React, { useEffect } from 'react';
import { Sparkles, Heart, Flame, Camera, Award, X } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ChatWrapped({ isOpen, onClose, stats }) {
  useEffect(() => {
    if (isOpen) {
      try {
        confetti({ particleCount: 80, spread: 100, origin: { y: 0.5 } });
      } catch (e) {}
    }
  }, [isOpen]);

  if (!isOpen || !stats) return null;

  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        className="card animate-slide-up"
        style={{
          width: '100%',
          maxWidth: '380px',
          background: 'linear-gradient(165deg, #1e1035 0%, #0d1222 100%)',
          border: '1.5px solid rgba(168, 85, 247, 0.4)',
          borderRadius: '24px',
          padding: '28px 24px',
          boxShadow: '0 20px 60px rgba(139, 92, 246, 0.35)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          textAlign: 'center'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          <X size={20} />
        </button>

        {/* Celebratory Icon */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 8px 30px rgba(236, 72, 153, 0.4)'
          }}
        >
          <Sparkles size={32} />
        </div>

        <div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--accent-warm)'
            }}
          >
            The Saviour Wrapped
          </span>
          <h2 style={{ fontSize: '22px', color: '#ffffff', margin: '4px 0 0 0' }}>
            Our Sanctuary Story
          </h2>
        </div>

        {/* Stat Highlights Grid */}
        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          <div
            style={{
              padding: '14px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-primary)' }}>
              {stats.totalMessages}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Messages Exchanged
            </div>
          </div>

          <div
            style={{
              padding: '14px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#f59e0b' }}>
              {stats.currentStreak} 🔥
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Day Chat Streak
            </div>
          </div>

          <div
            style={{
              padding: '14px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-cyan)' }}>
              {stats.photosCount} 📸
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Photos Shared
            </div>
          </div>

          <div
            style={{
              padding: '14px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#10b981' }}>
              {stats.busiestDay.slice(0, 3)} 📅
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Favorite Day
            </div>
          </div>
        </div>

        <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          "Every message here is a brick in the sanctuary we built together."
        </p>

        <button onClick={onClose} className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
          Cherish Our Journey ❤️
        </button>
      </div>
    </div>
  );
}
