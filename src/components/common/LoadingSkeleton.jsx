import React from 'react';

export default function LoadingSkeleton({ count = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', width: '100%' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: i % 2 === 0 ? 'flex-start' : 'flex-end',
            width: '100%'
          }}
        >
          <div
            style={{
              width: i % 2 === 0 ? '65%' : '50%',
              height: '48px',
              borderRadius: i % 2 === 0 ? '20px 20px 20px 4px' : '20px 20px 4px 20px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              animation: 'pulseGlow 1.8s infinite ease-in-out'
            }}
          />
        </div>
      ))}
    </div>
  );
}
