import React from 'react';
import Modal from '../common/Modal';
import { useChat } from '../../context/ChatContext';

const STICKERS_CATALOG = [
  { id: 'hugs', label: 'Sending Warm Hugs', emoji: '🤗' },
  { id: 'proud', label: 'So Proud of You!', emoji: '🌟' },
  { id: 'miss_you', label: 'Miss You Tons', emoji: '🥺' },
  { id: 'coffee', label: 'Need Coffee Stat', emoji: '☕' },
  { id: 'you_got_this', label: 'You Got This!', emoji: '💪' },
  { id: 'thinking_of_you', label: 'Thinking of You', emoji: '💭' },
  { id: 'heart_eyes', label: 'Completely In Love', emoji: '😍' },
  { id: 'celebrate', label: 'Huge Win Party!', emoji: '🥳' },
  { id: 'cozy', label: 'Cozy Blanket Mode', emoji: '🛋️' }
];

export default function StickersModal({ isOpen, onClose }) {
  const { sendStickerMessage } = useChat();

  const handleSelectSticker = async (sticker) => {
    try {
      await sendStickerMessage(sticker);
      onClose();
    } catch (err) {
      console.error('Failed to send sticker:', err);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Expressive Stickers ✨">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {STICKERS_CATALOG.map((sticker) => (
          <button
            key={sticker.id}
            onClick={() => handleSelectSticker(sticker)}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              transition: 'all 0.2s ease',
              textAlign: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-cyan)';
              e.currentTarget.style.transform = 'translateY(-3px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span style={{ fontSize: '36px' }}>{sticker.emoji}</span>
            <span style={{ fontSize: '11px', fontWeight: 600 }}>{sticker.label}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
