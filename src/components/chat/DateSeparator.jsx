import React from 'react';
import { formatDateSeparator } from '../../utils/dates';

export default function DateSeparator({ dateString }) {
  const formatted = formatDateSeparator(dateString);
  if (!formatted) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '14px 0 8px 0',
        width: '100%'
      }}
    >
      <span
        style={{
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid var(--border-subtle)',
          padding: '3px 12px',
          borderRadius: 'var(--radius-full)',
          fontSize: '11px',
          fontWeight: 500,
          color: 'var(--text-muted)',
          letterSpacing: '0.02em',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)'
        }}
      >
        {formatted}
      </span>
    </div>
  );
}
