import React, { useState, useRef, useEffect } from 'react';
import { Send, Image, Gift, Smile, X, Sparkles, Lock } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useCrypto } from '../../context/CryptoContext';

const QUICK_EMOJI_LIST = ['❤️', '🥰', '🥺', '😂', '✨', '🌹', '☕', '🔥', '🫂', '🌙', '🍕', '🎉'];

export default function MessageInput({
  replyTo,
  onCancelReply,
  onOpenGifts,
  onOpenStickers,
  onSelectPhotoFile
}) {
  const { sendTextMessage, broadcastTyping } = useChat();
  const { cryptoState, conversationKey, setUnlockModalOpen, setSetupModalOpen, resetIdentityKey } = useCrypto();
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const isKeyReady = cryptoState === 'ready' && Boolean(conversationKey);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  // Clean up typing indicator on unmount
  useEffect(() => {
    return () => {
      broadcastTyping(false);
    };
  }, [broadcastTyping]);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    if (val.trim().length > 0) {
      broadcastTyping(true);
    } else {
      broadcastTyping(false);
    }
  };

  const handleSecurityAction = () => {
    if (cryptoState === 'locked') {
      setUnlockModalOpen(true);
    } else if (cryptoState === 'missing_local_key') {
      const confirmed = window.confirm(
        'Encryption key missing on this device.\n\nBecause keys are stored on-device, your previous private key was not found in this browser. Generating a new key will allow you to send and receive new encrypted messages, but older messages encrypted with your previous key will remain unreadable.\n\nGenerate a new encryption key now?'
      );
      if (confirmed && resetIdentityKey) {
        resetIdentityKey().catch(err => alert('Failed to reset key: ' + err.message));
      }
    } else if (cryptoState === 'uninitialized') {
      if (resetIdentityKey) {
        resetIdentityKey().catch(err => alert('Failed to initialize key: ' + err.message));
      }
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!isKeyReady) {
      if (cryptoState === 'waiting_for_partner') {
        alert('Cannot send: Waiting for partner to connect and establish their encryption keys. Unencrypted messages are strictly prohibited.');
        return;
      }
      handleSecurityAction();
      return;
    }
    if (!text.trim() || isSending) return;

    // Immediately notify that user has stopped typing upon sending
    broadcastTyping(false);

    setIsSending(true);
    const contentToSend = text;
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      await sendTextMessage(contentToSend, replyTo);
      if (replyTo && onCancelReply) {
        onCancelReply();
      }
    } catch (err) {
      console.error('Failed to send text message:', err);
      setText(contentToSend); // Restore on error
    } finally {
      setIsSending(false);
      setShowEmojiPicker(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectPhotoFile(file);
      e.target.value = ''; // Reset input
    }
  };

  const addEmoji = (emoji) => {
    setText(prev => {
      const next = prev + emoji;
      broadcastTyping(true);
      return next;
    });
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="chat-input-area">
      {/* Reply-to preview banner */}
      {replyTo && (
        <div
          className="animate-slide-up"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 12px',
            borderLeft: '4px solid var(--accent-primary)',
            fontSize: '12px'
          }}
        >
          <div>
            <div style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
              Replying to {replyTo.sender_name}
            </div>
            <div style={{ color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '300px' }}>
              {replyTo.content}
            </div>
          </div>
          <button
            onClick={onCancelReply}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Quick emoji drawer */}
      {showEmojiPicker && (
        <div
          className="animate-fade-in"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '10px',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          {QUICK_EMOJI_LIST.map((emoji) => (
            <button
              key={emoji}
              onClick={() => addEmoji(emoji)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '22px',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '8px',
                transition: 'transform 0.1s ease'
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* E2EE Lock / Uninitialized / Waiting Security Bar */}
      {!isKeyReady && (
        <div
          onClick={handleSecurityAction}
          style={{
            cursor: (cryptoState === 'locked' || cryptoState === 'uninitialized' || cryptoState === 'missing_local_key') ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: cryptoState === 'waiting_for_partner' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: cryptoState === 'waiting_for_partner' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 12px',
            fontSize: '12px',
            color: cryptoState === 'waiting_for_partner' ? '#38bdf8' : '#f87171'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Lock size={14} />
            <span>
              {cryptoState === 'locked'
                ? 'Encryption vault locked — tap here to unlock'
                : cryptoState === 'missing_local_key'
                ? 'Encryption key missing on this device — tap here to reset'
                : cryptoState === 'key_mismatch'
                ? 'Partner encryption key changed — verify safety number'
                : cryptoState === 'waiting_for_partner'
                ? 'Waiting for partner to connect — messages will encrypt automatically'
                : 'Initializing end-to-end encryption...'}
            </span>
          </div>
          {(cryptoState === 'locked' || cryptoState === 'missing_local_key') && (
            <span style={{ textDecoration: 'underline', fontWeight: 600, fontSize: '11px' }}>
              {cryptoState === 'locked' ? 'Unlock' : 'Reset Key'}
            </span>
          )}
        </div>
      )}

      {/* Main input controls bar */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', width: '100%' }}>
        {/* Attachment menu items */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
          />

          {/* Photo attach button */}
          <button
            type="button"
            onClick={() => {
              if (!isKeyReady) {
                handleSecurityAction();
                return;
              }
              fileInputRef.current?.click();
            }}
            title={!isKeyReady ? 'Unlock encryption to send photos' : 'Send Photo'}
            className="btn-ghost"
            style={{
              padding: '8px',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)'
            }}
          >
            <Image size={20} />
          </button>

          {/* Virtual Gift button */}
          <button
            type="button"
            onClick={() => {
              if (!isKeyReady) {
                handleSecurityAction();
                return;
              }
              onOpenGifts();
            }}
            title={!isKeyReady ? 'Unlock encryption to send gifts' : 'Send Virtual Gift'}
            className="btn-ghost"
            style={{
              padding: '8px',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--accent-warm)'
            }}
          >
            <Gift size={20} />
          </button>

          {/* Stickers button */}
          <button
            type="button"
            onClick={() => {
              if (!isKeyReady) {
                handleSecurityAction();
                return;
              }
              onOpenStickers();
            }}
            title={!isKeyReady ? 'Unlock encryption to send expressions' : 'Stickers & Expressions'}
            className="btn-ghost"
            style={{
              padding: '8px',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--accent-cyan)'
            }}
          >
            <Sparkles size={20} />
          </button>
        </div>

        {/* Text Input area */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-input)',
            borderRadius: '20px',
            border: '1px solid var(--border-subtle)',
            padding: '4px 12px'
          }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onClick={() => {
              if (!isKeyReady) handleSecurityAction();
            }}
            placeholder={
              !isKeyReady
                ? (cryptoState === 'locked'
                  ? '🔒 Vault is locked — click to unlock...'
                  : cryptoState === 'missing_local_key'
                  ? '🔒 Encryption key missing — click to reset...'
                  : cryptoState === 'waiting_for_partner'
                  ? '🔒 Waiting for partner to connect...'
                  : '🔒 Initializing encryption...')
                : 'Whisper something sweet...'
            }
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)',
              fontSize: '14.5px',
              lineHeight: 1.4,
              resize: 'none',
              maxHeight: '120px',
              padding: '6px 0'
            }}
          />

          {/* Emoji toggle icon */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker(prev => !prev)}
            style={{
              background: 'none',
              border: 'none',
              color: showEmojiPicker ? 'var(--accent-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <Smile size={19} />
          </button>
        </div>

        {/* Send Action Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending || (isKeyReady && !text.trim())}
          className="btn btn-primary"
          title={!isKeyReady ? 'Encryption is locked or unready' : 'Send encrypted message'}
          style={{
            width: '42px',
            height: '42px',
            padding: 0,
            borderRadius: '50%',
            opacity: (!isKeyReady || text.trim()) ? 1 : 0.4,
            cursor: (!isKeyReady || text.trim()) ? 'pointer' : 'default',
            flexShrink: 0,
            backgroundColor: !isKeyReady ? 'rgba(239, 68, 68, 0.2)' : undefined,
            color: !isKeyReady ? '#f87171' : undefined
          }}
        >
          {!isKeyReady ? <Lock size={17} /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}
