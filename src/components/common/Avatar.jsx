import React from 'react';

export default function Avatar({ src, name = 'User', size = 36, online = false, className = '' }) {
  const initials = name
    ? name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  const avatarGradients = [
    'linear-gradient(135deg, #8b5cf6, #ec4899)',
    'linear-gradient(135deg, #6366f1, #38bdf8)',
    'linear-gradient(135deg, #10b981, #06b6d4)',
    'linear-gradient(135deg, #f59e0b, #ef4444)'
  ];

  // Pick deterministic gradient from name
  const gradIndex = name.charCodeAt(0) % avatarGradients.length;
  const gradient = avatarGradients[gradIndex];

  return (
    <div
      className={`relative inline-flex flex-shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover rounded-full shadow-sm"
          style={{ width: size, height: size, borderRadius: '50%' }}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-white font-semibold shadow-sm"
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: gradient,
            fontSize: Math.max(12, Math.floor(size * 0.38)),
            fontFamily: 'var(--font-display)',
            border: '1.5px solid rgba(255, 255, 255, 0.15)'
          }}
        >
          {initials}
        </div>
      )}

      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-slate-900"
          style={{
            width: Math.max(9, Math.floor(size * 0.28)),
            height: Math.max(9, Math.floor(size * 0.28)),
            borderRadius: '50%',
            backgroundColor: '#10b981',
            border: '2px solid var(--bg-primary)',
            position: 'absolute',
            bottom: 0,
            right: 0
          }}
        />
      )}
    </div>
  );
}
