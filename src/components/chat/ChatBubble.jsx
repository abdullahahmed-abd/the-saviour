import React, { useState } from 'react';
import { Check, CheckCheck, Clock, AlertCircle, Copy, Reply, Trash2, Bookmark, Heart, Smile } from 'lucide-react';
import Avatar from '../common/Avatar';
import { formatMessageTime } from '../../utils/dates';
import { saveToMemories } from '../../services/memories';

const QUICK_EMOJIS = ['❤️', '😂', '🥺', '🔥', '👏', '🎉'];

export default function ChatBubble({
  message,
  isSender,
  reactions = [],
  onReact,
  onReply,
  onDelete,
  onOpenImage,
  partnerReadMessageId,
  partnerReadAt,
  currentUserId
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedMemory, setSavedMemory] = useState(false);

  const isDeleted = message.is_deleted;
  const isImage = message.type === 'image';
  const isGift = message.type === 'gift';
  const isSticker = message.type === 'sticker';
  const metadata = message.metadata || {};

  // Read status: If sender's message, check if partner's last read id or timestamp covers this message
  const isReadByPartner = isSender && (
    message.status === 'read' ||
    (partnerReadMessageId && message.id === partnerReadMessageId) ||
    (partnerReadAt && new Date(message.created_at) <= new Date(partnerReadAt))
  );

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setShowMenu(false);
    }
  };

  const handleSaveMemory = async () => {
    try {
      await saveToMemories({
        userId: currentUserId,
        category: isImage ? 'photo' : isGift ? 'gift' : 'message',
        title: isGift ? metadata.title || 'Virtual Gift' : isImage ? 'Shared Photo' : 'Chat Message',
        content: message.content || '',
        mediaUrl: metadata.signed_url || metadata.photo_path || '',
        metadata: { message_id: message.id, original_sender: message.sender_id }
      });
      setSavedMemory(true);
      setTimeout(() => setSavedMemory(false), 2000);
      setShowMenu(false);
    } catch (e) {
      console.error('Error saving memory:', e);
    }
  };

  // Group reactions by emoji
  const reactionCounts = {};
  reactions.forEach(r => {
    reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isSender ? 'flex-end' : 'flex-start',
        width: '100%',
        position: 'relative',
        margin: '2px 0'
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: isSender ? 'row-reverse' : 'row',
          alignItems: 'flex-end',
          gap: '8px',
          maxWidth: '85%'
        }}
      >
        {/* Partner avatar */}
        {!isSender && (
          <Avatar
            src={message.profiles?.avatar_url}
            name={message.profiles?.display_name || 'Sanctuary'}
            size={28}
          />
        )}

        {/* Bubble container */}
        <div
          onClick={() => setShowMenu(prev => !prev)}
          style={{
            position: 'relative',
            cursor: 'pointer',
            background: isDeleted
              ? 'rgba(255, 255, 255, 0.04)'
              : isSender
              ? 'var(--bubble-sender)'
              : 'var(--bubble-receiver)',
            color: isSender ? 'var(--bubble-sender-text)' : 'var(--bubble-receiver-text)',
            borderRadius: isSender ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
            border: isSender ? 'none' : '1px solid var(--bubble-receiver-border)',
            padding: isGift || isSticker ? '8px' : '10px 14px',
            boxShadow: 'var(--shadow-sm)',
            wordBreak: 'break-word',
            fontSize: '14.5px',
            lineHeight: 1.45,
            transition: 'transform 0.15s ease'
          }}
        >
          {/* Reply Context Header */}
          {metadata.reply_to && (
            <div
              style={{
                borderLeft: `3px solid ${isSender ? 'rgba(255,255,255,0.7)' : 'var(--accent-primary)'}`,
                paddingLeft: '8px',
                marginBottom: '6px',
                fontSize: '12px',
                opacity: 0.85
              }}
            >
              <div style={{ fontWeight: 600 }}>{metadata.reply_to.sender_name}</div>
              <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                {metadata.reply_to.content}
              </div>
            </div>
          )}

          {/* Deleted Message State */}
          {isDeleted ? (
            <span style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '13px' }}>
              🚫 {message.content}
            </span>
          ) : isImage ? (
            /* Image Bubble */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (metadata.signed_url) onOpenImage(metadata.signed_url);
                }}
                style={{
                  borderRadius: '14px',
                  overflow: 'hidden',
                  maxHeight: '260px',
                  cursor: 'zoom-in',
                  backgroundColor: 'rgba(0,0,0,0.2)'
                }}
              >
                <img
                  src={metadata.signed_url || ''}
                  alt="Private Sanctuary Photo"
                  style={{
                    width: '100%',
                    height: 'auto',
                    maxHeight: '260px',
                    objectFit: 'cover',
                    display: 'block'
                  }}
                  loading="lazy"
                />
              </div>
              {message.content && <div>{message.content}</div>}
            </div>
          ) : isGift ? (
            /* Virtual Gift Card */
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                borderRadius: '16px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <span style={{ fontSize: '36px', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.3))' }}>
                {metadata.emoji}
              </span>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-cyan)' }}>
                  Virtual Gift
                </div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>{metadata.title}</div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>{metadata.message}</div>
              </div>
            </div>
          ) : isSticker ? (
            /* Expressive Sticker Card */
            <div
              style={{
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{ fontSize: '42px', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.2))' }}>
                {metadata.emoji}
              </span>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>{metadata.label}</span>
            </div>
          ) : (
            /* Standard Text */
            <div>{message.content}</div>
          )}

          {/* Time & Status footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '4px',
              marginTop: '4px',
              fontSize: '10.5px',
              opacity: 0.75
            }}
          >
            <span>{formatMessageTime(message.created_at)}</span>
            {isSender && (
              <span>
                {message.status === 'sending' ? (
                  <Clock size={11} />
                ) : message.status === 'failed' ? (
                  <AlertCircle size={11} color="#ef4444" />
                ) : isReadByPartner ? (
                  <CheckCheck size={13} color="#38bdf8" />
                ) : (
                  <Check size={13} />
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Emoji Reactions display pill */}
      {Object.keys(reactionCounts).length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '4px',
            marginTop: '-6px',
            marginLeft: isSender ? 0 : '36px',
            marginRight: isSender ? '6px' : 0,
            zIndex: 10
          }}
        >
          {Object.entries(reactionCounts).map(([emoji, count]) => (
            <button
              key={emoji}
              onClick={() => onReact(message.id, emoji)}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '2px 6px',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <span>{emoji}</span>
              {count > 1 && <span style={{ fontWeight: 600 }}>{count}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Floating Action Menu when tapped */}
      {showMenu && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute',
            top: '-46px',
            [isSender ? 'right' : 'left']: '10px',
            background: 'var(--bg-glass-heavy)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-full)',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: 'var(--shadow-md)',
            zIndex: 40
          }}
        >
          {/* Quick Reaction Emojis */}
          {QUICK_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => {
                onReact(message.id, emoji);
                setShowMenu(false);
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '16px',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '50%',
                transition: 'transform 0.15s ease'
              }}
            >
              {emoji}
            </button>
          ))}

          <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)', margin: '0 2px' }} />

          {/* Reply */}
          <button
            onClick={() => {
              onReply({
                id: message.id,
                sender_name: message.profiles?.display_name || 'Sanctuary',
                content: message.content ? message.content.slice(0, 50) : '[Photo/Gift]'
              });
              setShowMenu(false);
            }}
            title="Reply"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <Reply size={15} />
          </button>

          {/* Copy */}
          {message.content && !isDeleted && (
            <button
              onClick={handleCopy}
              title="Copy"
              style={{ background: 'none', border: 'none', color: copied ? 'var(--accent-primary)' : 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
            >
              <Copy size={15} />
            </button>
          )}

          {/* Save to Memories */}
          {!isDeleted && (
            <button
              onClick={handleSaveMemory}
              title="Save to Memories"
              style={{ background: 'none', border: 'none', color: savedMemory ? 'var(--accent-cyan)' : 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
            >
              <Bookmark size={15} />
            </button>
          )}

          {/* Delete (if sender) */}
          {isSender && !isDeleted && (
            <button
              onClick={() => {
                onDelete(message.id);
                setShowMenu(false);
              }}
              title="Delete"
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
