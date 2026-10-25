import React, { useState } from 'react';
import { ArrowLeft, Lightbulb, CheckCircle2, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';

const RIDDLES = [
  { emojis: '🦁 👑 🌅', answer: 'The Lion King', hint: 'Disney classic film' },
  { emojis: '🧊 🚢 💔 🌊', answer: 'Titanic', hint: 'Jack & Rose romance' },
  { emojis: '🕷️ 🧑 🕸️ 🏙️', answer: 'Spider-Man', hint: 'Marvel superhero in NYC' },
  { emojis: '💍 🌋 🧝 🧙‍♂️', answer: 'Lord of the Rings', hint: 'Precious ring journey to Mordor' },
  { emojis: '🍫 🏭 🎩 🎟️', answer: 'Charlie and the Chocolate Factory', hint: 'Willy Wonka golden ticket' },
  { emojis: '☕ 🍩 ☔ 🌧️', answer: 'Rainy Cafe Date', hint: 'A cozy day together' }
];

export default function EmojiRiddle({ onBack }) {
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const cur = RIDDLES[index];

  const handleCheck = (e) => {
    e?.preventDefault();
    if (!guess.trim()) return;

    const normalizedGuess = guess.trim().toLowerCase();
    const normalizedAnswer = cur.answer.toLowerCase();

    if (normalizedGuess === normalizedAnswer || normalizedAnswer.includes(normalizedGuess)) {
      setIsCorrect(true);
      try {
        confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
      } catch (err) {}
    } else {
      alert('Not quite! Try again or tap the hint 💡');
    }
  };

  const handleNext = () => {
    setIndex((index + 1) % RIDDLES.length);
    setGuess('');
    setShowHint(false);
    setIsCorrect(false);
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase' }}>
            Emoji Riddle {index + 1} of {RIDDLES.length}
          </span>
          <button
            onClick={() => setShowHint(!showHint)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-primary)',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Lightbulb size={14} />
            {showHint ? cur.hint : 'Need a hint?'}
          </button>
        </div>

        {/* Emoji Display Box */}
        <div
          style={{
            background: 'var(--bg-input)',
            borderRadius: '20px',
            padding: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border-subtle)',
            fontSize: '44px',
            letterSpacing: '8px'
          }}
        >
          {cur.emojis}
        </div>

        {!isCorrect ? (
          <form onSubmit={handleCheck} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="What movie or phrase is this?"
              style={{
                flex: 1,
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0 18px' }}>
              Guess
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center', padding: '10px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 700, fontSize: '16px' }}>
              <CheckCircle2 size={22} />
              Spot On! "{cur.answer}"
            </div>
            <button onClick={handleNext} className="btn btn-primary" style={{ padding: '10px 24px' }}>
              Next Riddle →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
