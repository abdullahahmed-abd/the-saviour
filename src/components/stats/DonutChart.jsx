import React from 'react';

export default function DonutChart({
  user1Count = 0,
  user2Count = 0,
  user1Name = 'You',
  user2Name = 'Partner'
}) {
  const total = user1Count + user2Count;
  const u1Pct = total > 0 ? Math.round((user1Count / total) * 100) : 50;
  const u2Pct = total > 0 ? 100 - u1Pct : 50;

  // SVG circle calculations (circumference = 2 * PI * r = ~251.3)
  const radius = 40;
  const circ = 2 * Math.PI * radius;
  const strokeOffset = circ - (circ * u1Pct) / 100;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '16px', padding: '8px 0' }}>
      {/* SVG Donut */}
      <div style={{ position: 'relative', width: '100px', height: '100px' }}>
        <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle for Partner */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="#38bdf8"
            strokeWidth="12"
          />
          {/* Foreground circle for User 1 */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="#8b5cf6"
            strokeWidth="12"
            strokeDasharray={circ}
            strokeDashoffset={strokeOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-primary)'
          }}
        >
          <span>{total}</span>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>msgs</span>
        </div>
      </div>

      {/* Legend & Percentages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#8b5cf6' }} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {user1Name}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {user1Count} ({u1Pct}%)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#38bdf8' }} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {user2Name}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {user2Count} ({u2Pct}%)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
