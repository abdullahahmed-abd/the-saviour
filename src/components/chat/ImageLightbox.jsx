import React from 'react';
import { X, Download } from 'lucide-react';

export default function ImageLightbox({ imageUrl, isOpen, onClose }) {
  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      {/* Top action bar */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(16px + var(--sat))',
          right: '16px',
          display: 'flex',
          gap: '12px',
          zIndex: 210
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <a
          href={imageUrl}
          download="sanctuary_photo.webp"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            padding: '10px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none'
          }}
          title="Download Photo"
        >
          <Download size={20} />
        </a>

        <button
          onClick={onClose}
          className="btn-ghost"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            padding: '10px',
            border: 'none',
            color: '#ffffff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Close Lightbox"
        >
          <X size={20} />
        </button>
      </div>

      {/* Image display */}
      <img
        src={imageUrl}
        alt="Sanctuary Fullscreen"
        style={{
          maxWidth: '100%',
          maxHeight: '85vh',
          objectFit: 'contain',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)'
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
