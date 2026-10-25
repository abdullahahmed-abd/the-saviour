import React from 'react';

export default function ActivityChart({ data = [], title = 'Hourly Activity' }) {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map(d => d.count), 1);
  const chartHeight = 120;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
        {title}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '3px',
          height: `${chartHeight}px`,
          padding: '8px 0',
          borderBottom: '1px solid var(--border-subtle)',
          width: '100%',
          overflowX: 'auto'
        }}
      >
        {data.map((item, idx) => {
          const barHeight = Math.max(Math.round((item.count / maxVal) * (chartHeight - 20)), 4);
          const isPeak = item.count === maxVal && item.count > 0;

          return (
            <div
              key={idx}
              title={`${item.label || item.day}: ${item.count} messages`}
              style={{
                flex: 1,
                minWidth: '10px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                justifyContent: 'flex-end'
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: '12px',
                  height: `${barHeight}px`,
                  borderRadius: '3px 3px 0 0',
                  background: isPeak
                    ? 'var(--accent-gradient)'
                    : item.count > 0
                    ? 'rgba(139, 92, 246, 0.45)'
                    : 'rgba(255, 255, 255, 0.05)',
                  transition: 'height 0.4s ease'
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Axis Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
        <span>12 AM</span>
        <span>6 AM</span>
        <span>12 PM</span>
        <span>6 PM</span>
        <span>11 PM</span>
      </div>
    </div>
  );
}
