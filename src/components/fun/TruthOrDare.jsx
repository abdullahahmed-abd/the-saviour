import React, { useState } from 'react';
import { ArrowLeft, Sparkles, Shuffle } from 'lucide-react';

const TRUTHS = [
  'What was the exact moment you realized you had special feelings for me?',
  'What is an embarrassing fashion trend or haircut you used to rock?',
  'If you could read my mind for 5 minutes, what would you want to find out?',
  'What is something silly or weird you do when you are completely alone?',
  'What is your favorite memory of us laughing until our stomachs hurt?',
  'What is something you were nervous about when we first started talking?'
];

const DARES = [
  'Send a 10-second voice note singing the chorus of the cheesiest song you know.',
  'Take an unfiltered, ridiculously silly selfie right now and send it to our chat.',
  'Speak in a fake royal British or Victorian accent for your next 5 messages.',
  'Send me a virtual gift with a mini poem explaining why that item fits us.',
  'Do 10 jumping jacks or stretches right now and report back with proof!',
  'Change your chat status message to something funny chosen by me for the next hour.'
];

export default function TruthOrDare({ onBack }) {
  const [mode, setMode] = useState(null); // 'truth' | 'dare'
  const [prompt, setPrompt] = useState('');

  const pickTruth = () => {
    setMode('truth');
    const random = TRUTHS[Math.floor(Math.random() * TRUTHS.length)];
    setPrompt(random);
  };

  const pickDare = () => {
    setMode('dare');
    const random = DARES[Math.floor(Math.random() * DARES.length)];
    setPrompt(random);
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
        <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', textAlign: 'center' }}>
          Truth or Silly Dare 🎭
        </h3>

        {/* Choice buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button
            onClick={pickTruth}
            className="btn"
            style={{
              background: mode === 'truth' ? 'rgba(56, 189, 248, 0.25)' : 'var(--bg-input)',
              border: '1.5px solid #38bdf8',
              color: '#38bdf8',
              padding: '16px',
              borderRadius: 'var(--radius-lg)',
              fontSize: '16px',
              fontWeight: 700
            }}
          >
            Truth 💭
          </button>

          <button
            onClick={pickDare}
            className="btn"
            style={{
              background: mode === 'dare' ? 'rgba(244, 63, 94, 0.25)' : 'var(--bg-input)',
              border: '1.5px solid #f43f5e',
              color: '#f43f5e',
              padding: '16px',
              borderRadius: 'var(--radius-lg)',
              fontSize: '16px',
              fontWeight: 700
            }}
          >
            Dare ⚡
          </button>
        </div>

        {/* Selected Prompt Display */}
        {prompt && (
          <div
            className="animate-slide-up"
            style={{
              padding: '20px',
              borderRadius: 'var(--radius-md)',
              background: mode === 'truth' ? 'rgba(56, 189, 248, 0.1)' : 'rgba(244, 63, 94, 0.1)',
              border: `1px solid ${mode === 'truth' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginTop: '10px'
            }}
          >
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: mode === 'truth' ? '#38bdf8' : '#f43f5e' }}>
              Your {mode}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.45 }}>
              "{prompt}"
            </div>

            <button
              onClick={mode === 'truth' ? pickTruth : pickDare}
              className="btn btn-ghost"
              style={{ alignSelf: 'center', fontSize: '12px', gap: '4px' }}
            >
              <Shuffle size={14} /> Another {mode}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
