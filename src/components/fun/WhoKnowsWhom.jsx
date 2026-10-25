import React, { useState } from 'react';
import { ArrowLeft, Check, Award, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';

const QUESTIONS = [
  { q: 'What is my favorite way to spend a quiet Sunday afternoon?', options: ['Bingeing movies/shows 🎬', 'Reading with cozy music 📖', 'Cooking or baking 🍳', 'Sleeping in & chilling 😴'] },
  { q: 'What is my go-to order when getting drinks or coffee?', options: ['Iced Caramel Latte ☕', 'Masala Chai 🫖', 'Matcha or Green Tea 🍵', 'Fresh Juice or Smoothie 🥤'] },
  { q: 'What is my biggest pet peeve?', options: ['Slow walkers or bad drivers 🚗', 'People being late ⏰', 'Loud chewers 🥣', 'Unread notifications 📱'] },
  { q: 'If I won a free flight right now, what destination would I pick?', options: ['Tokyo / Kyoto 🌸', 'Swiss Alps 🏔️', 'Tropical Beach in Bali 🏖️', 'Paris or Rome 🏛️'] },
  { q: 'What kind of movies do I secretly love most?', options: ['Mind-bending Sci-Fi 🚀', 'Cheesy Rom-Coms 💖', 'Psychological Thrillers 🕵️', 'Animated Studio Ghibli 🏮'] }
];

export default function WhoKnowsWhom({ onBack }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [finished, setFinished] = useState(false);

  const curQ = QUESTIONS[currentIdx];

  const handleSelectOption = (opt) => {
    const updated = { ...selectedAnswers, [currentIdx]: opt };
    setSelectedAnswers(updated);

    if (currentIdx < QUESTIONS.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      setFinished(true);
      try {
        confetti({ particleCount: 70, spread: 90, origin: { y: 0.6 } });
      } catch (e) {}
    }
  };

  const handleRestart = () => {
    setSelectedAnswers({});
    setCurrentIdx(0);
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
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                Question {currentIdx + 1} of {QUESTIONS.length}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {QUESTIONS.map((_, i) => (
                  <span
                    key={i}
                    style={{
                      width: '18px',
                      height: '5px',
                      borderRadius: '4px',
                      backgroundColor: i <= currentIdx ? 'var(--accent-primary)' : 'var(--border-subtle)'
                    }}
                  />
                ))}
              </div>
            </div>

            <h3 style={{ fontSize: '17px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
              {curQ.q}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {curQ.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleSelectOption(opt)}
                  className="btn btn-secondary"
                  style={{
                    justifyContent: 'flex-start',
                    padding: '12px 16px',
                    fontSize: '14px',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'left'
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--accent-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)'
              }}
            >
              <Award size={36} />
            </div>

            <h3 style={{ fontSize: '20px', color: 'var(--text-primary)' }}>Answers Recorded! 🏆</h3>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '300px' }}>
              You completed all 5 questions. Share and compare your answers in sanctuary chat to see who knows who best!
            </p>

            <button onClick={handleRestart} className="btn btn-primary" style={{ padding: '10px 20px', gap: '8px' }}>
              <RotateCcw size={15} /> Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
