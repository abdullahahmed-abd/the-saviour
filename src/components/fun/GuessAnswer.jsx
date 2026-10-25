import React, { useState } from 'react';
import { ArrowLeft, Send, Eye, RotateCcw } from 'lucide-react';

const PROMPTS = [
  'What number between 1 and 100 am I thinking of right now?',
  'If I had to describe you with one single animal, what would it be?',
  'What is one food or drink item I am currently craving?',
  'Which song has been stuck in my head today?',
  'What was the best part of my week?'
];

export default function GuessAnswer({ onBack }) {
  const [promptIdx, setPromptIdx] = useState(0);
  const [secretAnswer, setSecretAnswer] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const curPrompt = PROMPTS[promptIdx];

  const handleLock = () => {
    if (secretAnswer.trim()) {
      setIsLocked(true);
    }
  };

  const handleNextPrompt = () => {
    setPromptIdx((promptIdx + 1) % PROMPTS.length);
    setSecretAnswer('');
    setIsLocked(false);
    setRevealed(false);
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
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8', textTransform: 'uppercase' }}>
            Prompt #{promptIdx + 1}
          </span>
          <button
            onClick={handleNextPrompt}
            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '12px', cursor: 'pointer' }}
          >
            Change Prompt ↻
          </button>
        </div>

        <h3 style={{ fontSize: '17px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
          "{curPrompt}"
        </h3>

        {!isLocked ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              Type your secret answer below. Once locked, pass your phone or ask your partner in chat to guess!
            </p>
            <input
              type="text"
              value={secretAnswer}
              onChange={(e) => setSecretAnswer(e.target.value)}
              placeholder="Your secret answer..."
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <button
              onClick={handleLock}
              disabled={!secretAnswer.trim()}
              className="btn btn-primary"
              style={{ padding: '12px' }}
            >
              🔒 Lock Secret Answer
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Secret answer is securely locked! Ask your partner to make their guess.
            </div>

            {revealed ? (
              <div
                style={{
                  padding: '18px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1.5px solid #38bdf8',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--text-primary)'
                }}
              >
                "{secretAnswer}"
              </div>
            ) : (
              <button
                onClick={() => setRevealed(true)}
                className="btn btn-secondary"
                style={{ alignSelf: 'center', padding: '10px 20px', gap: '8px' }}
              >
                <Eye size={16} /> Reveal Secret Answer
              </button>
            )}

            <button
              onClick={handleNextPrompt}
              className="btn btn-ghost"
              style={{ alignSelf: 'center', marginTop: '10px', fontSize: '13px' }}
            >
              Next Prompt →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
