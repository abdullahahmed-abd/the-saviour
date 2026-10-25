import React, { useState, useEffect } from 'react';
import { Sparkles, Check, Bookmark, RotateCcw } from 'lucide-react';
import Modal from '../common/Modal';
import { getDailyMysteryCard, markCardCompleted } from '../../services/cards';
import { saveToMemories } from '../../services/memories';
import { useAuth } from '../../context/AuthContext';
import confetti from 'canvas-confetti';

export default function MysteryCardModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [cardData, setCardData] = useState(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [savedMemory, setSavedMemory] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      loadCard();
    }
  }, [isOpen, user]);

  const loadCard = async () => {
    try {
      const data = await getDailyMysteryCard(user.id);
      setCardData(data.card);
      if (data.interaction?.is_completed) {
        setCompleted(true);
        setIsFlipped(true);
      } else {
        setIsFlipped(false);
      }
    } catch (err) {
      console.warn('Error loading mystery card:', err);
    }
  };

  const handleFlip = () => {
    if (!isFlipped) {
      setIsFlipped(true);
      try {
        confetti({ particleCount: 30, spread: 60, origin: { y: 0.6 } });
      } catch (e) {}
    }
  };

  const handleComplete = async () => {
    if (!cardData || completed || !user) return;
    try {
      await markCardCompleted(cardData.id, user.id);
      setCompleted(true);
      try {
        confetti({ particleCount: 50, spread: 80, origin: { y: 0.6 } });
      } catch (e) {}
    } catch (err) {
      console.error('Failed to complete card:', err);
    }
  };

  const handleSaveToMemories = async () => {
    if (!cardData) return;
    try {
      await saveToMemories({
        userId: user.id,
        category: 'note',
        title: `Daily Mystery Card: ${cardData.card_type.toUpperCase()}`,
        content: `${cardData.content}\n\n${cardData.subtext || ''}`,
        metadata: { card_id: cardData.id, type: cardData.card_type }
      });
      setSavedMemory(true);
      setTimeout(() => setSavedMemory(false), 2000);
    } catch (e) {
      console.error('Error saving card to memories:', e);
    }
  };

  if (!cardData) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Daily Mystery Card ✨">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '10px 0' }}>
        {/* Flip Card Container */}
        <div
          onClick={handleFlip}
          style={{
            width: '100%',
            maxWidth: '340px',
            minHeight: '230px',
            perspective: '1000px',
            cursor: isFlipped ? 'default' : 'pointer'
          }}
        >
          <div
            style={{
              width: '100%',
              minHeight: '230px',
              borderRadius: '20px',
              position: 'relative',
              transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'none',
              boxShadow: 'var(--shadow-md)'
            }}
          >
            {/* Front Side (Unrevealed) */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, #1e1b4b 0%, #31104b 100%)',
                border: '1.5px solid var(--border-highlight)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '24px',
                textAlign: 'center'
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'var(--accent-glow)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary)'
                }}
              >
                <Sparkles size={28} />
              </div>
              <h3 style={{ fontSize: '18px', color: '#ffffff' }}>Your Daily Mystery</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                Tap anywhere on this card to flip and reveal today's surprise!
              </p>
            </div>

            {/* Back Side (Revealed) */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                borderRadius: '20px',
                background: 'var(--bg-surface)',
                border: '1.5px solid var(--accent-primary)',
                transform: 'rotateY(180deg)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '22px',
                boxShadow: '0 0 25px var(--accent-glow)'
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--accent-primary)'
                  }}
                >
                  {cardData.card_type}
                </span>
                <p style={{ fontSize: '15.5px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '8px', lineHeight: 1.45 }}>
                  "{cardData.content}"
                </p>
                {cardData.subtext && (
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', fontStyle: 'italic' }}>
                    {cardData.subtext}
                  </p>
                )}
              </div>

              {completed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '12px', fontWeight: 600 }}>
                  <Check size={16} /> Completed today!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        {isFlipped && (
          <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '340px' }}>
            <button
              onClick={handleComplete}
              disabled={completed}
              className="btn btn-primary"
              style={{ flex: 1, padding: '10px', fontSize: '13px' }}
            >
              <Check size={15} />
              {completed ? 'Completed' : 'Mark Done'}
            </button>

            <button
              onClick={handleSaveToMemories}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '10px', fontSize: '13px' }}
            >
              <Bookmark size={15} color={savedMemory ? 'var(--accent-cyan)' : 'currentColor'} />
              {savedMemory ? 'Saved!' : 'Save Card'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
