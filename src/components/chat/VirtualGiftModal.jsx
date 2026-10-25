import React from 'react';
import Modal from '../common/Modal';
import { useChat } from '../../context/ChatContext';

const GIFTS_CATALOG = [
  { id: 'chai', title: 'Hot Masala Chai', emoji: '☕', message: 'Brewed with cardamom, ginger, and boundless love.', color: '#d97706' },
  { id: 'pizza', title: 'Cheesy Slice of Pizza', emoji: '🍕', message: 'Extra cheese for the sweetest human on Earth.', color: '#ea580c' },
  { id: 'teddy', title: 'Fluffy Teddy Bear', emoji: '🧸', message: 'A warm sanctuary hug you can hold tight anytime.', color: '#9333ea' },
  { id: 'rose', title: 'Crimson Rose', emoji: '🌹', message: 'A single timeless flower that will never wilt.', color: '#e11d48' },
  { id: 'chocolate', title: 'Dark Truffle Chocolate', emoji: '🍫', message: 'Sweet, rich, and guaranteed to lift your mood.', color: '#78350f' },
  { id: 'crown', title: 'Golden Sovereign Crown', emoji: '👑', message: 'Because you rule my heart completely.', color: '#ca8a04' },
  { id: 'panda', title: 'Playful Little Panda', emoji: '🐼', message: 'Rolling over for treats and belly rubs.', color: '#0284c7' },
  { id: 'cake', title: 'Velvet Birthday Cake', emoji: '🎂', message: 'Every single day with you is a celebration.', color: '#ec4899' },
  { id: 'trophy', title: 'Drama Queen Trophy', emoji: '🏆', message: 'Awarded for unmatched dramatic flair and cuteness!', color: '#8b5cf6' }
];

export default function VirtualGiftModal({ isOpen, onClose }) {
  const { sendGiftMessage } = useChat();

  const handleSelectGift = async (gift) => {
    try {
      await sendGiftMessage(gift);
      onClose();
    } catch (err) {
      console.error('Failed to send gift:', err);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send a Free Virtual Gift 🎁">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {GIFTS_CATALOG.map((gift) => (
          <button
            key={gift.id}
            onClick={() => handleSelectGift(gift)}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              transition: 'all 0.2s ease',
              textAlign: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
              e.currentTarget.style.transform = 'translateY(-3px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span style={{ fontSize: '32px' }}>{gift.emoji}</span>
            <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-display)', lineHeight: 1.2 }}>
              {gift.title}
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
