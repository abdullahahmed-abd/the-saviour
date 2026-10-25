import React from 'react';

/**
 * The Saviour — Custom Premium Logo
 * Design Concept:
 * - Distinctive shield emblem representing protection, strength, and sanctuary.
 * - Faceted geometric Polaris/guardian star with light & dark chiseled metallic relief.
 * - Precision midnight navy core, metallic platinum/silver borders, and restrained electric-blue glow.
 * - Reusable React SVG component with 'full' (emblem + typography) and 'emblem' variants.
 */
export default function SaviourLogo({
  variant = 'full', // 'full' | 'emblem'
  size = 64,        // emblem size in px
  showText = true,
  className = '',
  style = {}
}) {
  const emblemWidth = size;
  const emblemHeight = Math.round(size * 1.16);

  const EmblemSVG = (
    <svg
      width={emblemWidth}
      height={emblemHeight}
      viewBox="0 0 120 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', overflow: 'visible', flexShrink: 0 }}
      aria-hidden="true"
    >
      <defs>
        {/* Midnight Navy Core Gradient */}
        <linearGradient id="saviour-core" x1="60" y1="6" x2="60" y2="134" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0d1726" />
          <stop offset="50%" stopColor="#080e18" />
          <stop offset="100%" stopColor="#03060b" />
        </linearGradient>

        {/* Metallic Platinum / Silver Bevel Rim */}
        <linearGradient id="saviour-rim" x1="16" y1="10" x2="104" y2="130" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="25%" stopColor="#64748b" />
          <stop offset="50%" stopColor="#f8fafc" />
          <stop offset="75%" stopColor="#475569" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>

        {/* Inner Crest Accent Rim */}
        <linearGradient id="saviour-inner-rim" x1="60" y1="20" x2="60" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
          <stop offset="40%" stopColor="#1e293b" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0.7" />
        </linearGradient>

        {/* Faceted Star Shading: Light */}
        <linearGradient id="star-light" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>

        {/* Faceted Star Shading: Dark */}
        <linearGradient id="star-dark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>

        {/* Electric Blue Core Glow */}
        <radialGradient id="star-core-glow" cx="60" cy="68" r="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#0284c7" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
        </radialGradient>

        {/* Restrained Ambient Glow */}
        <filter id="restrained-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Ambient Electric-Blue Soft Glow Aura */}
      <circle cx="60" cy="68" r="32" fill="url(#star-core-glow)" />

      {/* Primary Outer Shield Geometry */}
      <path
        d="M60 8
           C78 8 100 12 108 22
           C110 52 104 88 60 132
           C16 88 10 52 12 22
           C20 12 42 8 60 8Z"
        fill="url(#saviour-core)"
        stroke="url(#saviour-rim)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />

      {/* Inner Precision Inlay Shield */}
      <path
        d="M60 16
           C75 16 93 19 99 28
           C101 54 95 83 60 121
           C25 83 19 54 21 28
           C27 19 45 16 60 16Z"
        fill="none"
        stroke="url(#saviour-inner-rim)"
        strokeWidth="1.2"
        strokeDasharray="160 2"
        opacity="0.9"
      />

      {/* Subtle Coordinate / Sanctuary Horizontal Axis Lines */}
      <line x1="28" y1="68" x2="44" y2="68" stroke="#38bdf8" strokeWidth="0.8" opacity="0.4" />
      <line x1="76" y1="68" x2="92" y2="68" stroke="#38bdf8" strokeWidth="0.8" opacity="0.4" />

      {/* Central Guardian / Polaris Star (Precision 8-Point Faceted Diamond) */}
      <g filter="url(#restrained-glow)">
        {/* Vertical Top Ray */}
        <polygon points="60,34 60,68 53,68" fill="url(#star-dark)" />
        <polygon points="60,34 67,68 60,68" fill="url(#star-light)" />

        {/* Vertical Bottom Ray */}
        <polygon points="60,102 60,68 67,68" fill="url(#star-dark)" />
        <polygon points="60,102 53,68 60,68" fill="url(#star-light)" />

        {/* Horizontal Left Ray */}
        <polygon points="26,68 60,61 60,68" fill="url(#star-light)" />
        <polygon points="26,68 60,68 60,75" fill="url(#star-dark)" />

        {/* Horizontal Right Ray */}
        <polygon points="94,68 60,68 60,61" fill="url(#star-dark)" />
        <polygon points="94,68 60,75 60,68" fill="url(#star-light)" />

        {/* Diagonal Top-Left Ray */}
        <polygon points="38,46 60,64 56,60" fill="url(#star-light)" />
        <polygon points="38,46 60,68 60,64" fill="url(#star-dark)" />

        {/* Diagonal Top-Right Ray */}
        <polygon points="82,46 60,64 64,60" fill="url(#star-dark)" />
        <polygon points="82,46 60,68 60,64" fill="url(#star-light)" />

        {/* Diagonal Bottom-Left Ray */}
        <polygon points="38,90 60,68 56,76" fill="url(#star-dark)" />
        <polygon points="38,90 60,72 60,68" fill="url(#star-light)" />

        {/* Diagonal Bottom-Right Ray */}
        <polygon points="82,90 60,68 64,76" fill="url(#star-light)" />
        <polygon points="82,90 60,72 60,68" fill="url(#star-dark)" />

        {/* Center Diamond Jewel */}
        <polygon points="60,62 66,68 60,74 54,68" fill="#f8fafc" />
        <polygon points="60,64 64,68 60,72 56,68" fill="#38bdf8" opacity="0.9" />
      </g>
    </svg>
  );

  if (variant === 'emblem') {
    return (
      <div
        className={`inline-flex items-center justify-center ${className}`}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}
      >
        {EmblemSVG}
      </div>
    );
  }

  // Full Brand presentation (Emblem + "THE SAVIOUR" typography)
  return (
    <div
      className={`flex flex-col items-center justify-center select-none ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        gap: '14px',
        ...style
      }}
    >
      {EmblemSVG}

      {showText && (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span
            style={{
              fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '0.28em',
              textIndent: '0.28em', // balance letter-spacing visually
              color: '#f8fafc',
              textTransform: 'uppercase',
              lineHeight: 1.15,
              textShadow: '0 2px 14px rgba(56, 189, 248, 0.25)'
            }}
          >
            THE SAVIOUR
          </span>
        </div>
      )}
    </div>
  );
}
