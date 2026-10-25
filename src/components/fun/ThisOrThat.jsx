import React, { useState } from 'react';
import { ArrowLeft, RotateCcw, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

const PAIRS = [
  { a: 'Late night deep talks 🌙', b: 'Early morning walks ☀️' },
  { a: 'Cozy night in 🛋️', b: 'Adventurous night out 🌃' },
  { a: 'Sweet desserts 🍰', b: 'Savory & spicy snacks 🍕' },
  { a: 'Sunny beach vacation 🏖️', b: 'Misty mountain cabin 🏔️' },
  { a: 'Long voice calls 📞', b: 'Endless texting 💬' },
  { a: 'Cook at home together 🍳', b: 'Order takeout feast 🥡' },
  { a: 'Watch a movie 🎬', b: 'Listen to music & vibe 🎶' },
  { a: 'Scenic road trip 🚗', b: 'Fast flight to a city ✈️' }
];

export default function ThisOrThat({ onBack }) {
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState([]);
  const [finished, setFinished] = useState(false);

  const curPair = PAIRS[index];

  const handlePick = (choice) => {
    const updated = [...picks, { question: `${curPair.a} vs ${curPair.b}`, choice }];
    setPicks(updated);

    if (index < PAIRS.length - 1) {
      setIndex(index + 1);
    } else {
      setFinished(true);
      try {
        confetti({ particleCount: 60, spread: 80, origin: { y: 0.6 } });
      } catch (e) {}
    }
  };

  const handleRestart = () => {
    setIndex(0);
    setPicks([]);
    setFinished(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <button
        onClick={onBack}
        className="btn-ghost"
        style={{
          alignSelf: 'flex-start',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          border: 'none',
          cursor: 'pointer',
          padding: '6px 0',
          color: 'var(--text-muted)'
        }}
      >
        <ArrowLeft size={16} /> Back to Games
      </button>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {!finished ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#ec4899', textTransform: 'uppercase' }}>
                Round {index + 1} of {PAIRS.length}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Choose your vibe</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '10px 0' }}>
              {/* Option A */}
              <button
                onClick={() => handlePick(curPair.a)}
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(139, 92, 246, 0.15))',
                  border: '1.5px solid rgba(236, 72, 153, 0.3)',
                  color: 'var(--text-primary)',
                  padding: '22px 18px',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '16px',
                  fontWeight: 600
                }}
              >
                {curPair.a}
              </button>

              <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)' }}>
                — OR —
              </div>

              {/* Option B */}
              <button
                onClick={() => handlePick(curPair.b)}
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(99, 102, 241, 0.15))',
                  border: '1.5px solid rgba(56, 189, 248, 0.3)',
                  color: 'var(--text-primary)',
                  padding: '22px 18px',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '16px',
                  fontWeight: 600
                }}
              >
                {curPair.b}
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center', textAlign: 'center', padding: '16px 0' }}>
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'rgba(236, 72, 153, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ec4899'
              }}
            >
              <Sparkles size={32} />
            </div>

            <h3 style={{ fontSize: '19px', color: 'var(--text-primary)' }}>Your Vibe Profile 💖</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Here are your selections:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', textAlign: 'left' }}>
              {picks.map((p, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '12.5px',
                    color: 'var(--text-primary)'
                  }}
                >
                  ✓ {p.choice}
                </div>
              ))}
            </div>

            <button onClick={handleRestart} className="btn btn-primary" style={{ marginTop: '8px' }}>
              <RotateCcw size={15} /> Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
