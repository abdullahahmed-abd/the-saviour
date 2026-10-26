import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import ChatBubble from '../components/chat/ChatBubble';
import MessageInput from '../components/chat/MessageInput';
import DateSeparator from '../components/chat/DateSeparator';
import VirtualGiftModal from '../components/chat/VirtualGiftModal';
import StickersModal from '../components/chat/StickersModal';
import AttachmentModal from '../components/chat/AttachmentModal';
import ImageLightbox from '../components/chat/ImageLightbox';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import { Heart, Search, X, Shield, ShieldAlert, Sparkles } from 'lucide-react';

export default function Chat({ isSearching, onToggleSearch }) {
  const { user } = useAuth();
  const {
    messages,
    reactions,
    readStates,
    loadingMessages,
    hasMoreMessages,
    partnerTyping,
    loadMoreMessages,
    toggleReaction,
    deleteMsg,
    clearUnreadableMessages,
    markChatRead
  } = useChat();

  const [replyTo, setReplyTo] = useState(null);
  const [showGiftsModal, setShowGiftsModal] = useState(false);
  const [showStickersModal, setShowStickersModal] = useState(false);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const scrollRef = useRef(null);
  const bottomAnchorRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const prevLastMsgIdRef = useRef(null);
  const isInitialScrollDoneRef = useRef(false);
  const isPaginatingRef = useRef(false);

  // 1. Initial jump to bottom on open: Instant (no smooth animation fighting user touch)
  useEffect(() => {
    if (!loadingMessages && messages.length > 0 && !isInitialScrollDoneRef.current) {
      if (bottomAnchorRef.current) {
        bottomAnchorRef.current.scrollIntoView({ behavior: 'auto' });
      }
      isInitialScrollDoneRef.current = true;
      prevLastMsgIdRef.current = messages[messages.length - 1]?.id;
      markChatRead();
    }
  }, [loadingMessages, messages.length, markChatRead]);

  // 2. New message arriving at bottom: Auto-scroll only if sent by user OR user was already at bottom
  useEffect(() => {
    if (!isInitialScrollDoneRef.current || messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.id !== prevLastMsgIdRef.current) {
      prevLastMsgIdRef.current = lastMsg.id;
      const isSentByMe = lastMsg.sender_id === user?.id;

      if (isSentByMe || isAtBottomRef.current) {
        requestAnimationFrame(() => {
          bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
        });
      }
      markChatRead();
    }
  }, [messages, user?.id, markChatRead]);

  // 3. Partner typing: only gently scroll into view if user is already watching at the bottom
  useEffect(() => {
    if (partnerTyping && isAtBottomRef.current) {
      requestAnimationFrame(() => {
        bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, [partnerTyping]);

  // 4. Smooth scrolling & pagination handler with scroll position preservation
  const handleScroll = (e) => {
    const target = e.target;
    // Calculate if user is near bottom (within 70px)
    const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    isAtBottomRef.current = distanceToBottom < 70;

    // Trigger load older messages when near top
    if (target.scrollTop < 60 && hasMoreMessages && !loadingMessages && !isPaginatingRef.current) {
      isPaginatingRef.current = true;
      const prevScrollHeight = target.scrollHeight;
      const prevScrollTop = target.scrollTop;

      loadMoreMessages().finally(() => {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            const newScrollHeight = scrollRef.current.scrollHeight;
            scrollRef.current.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
          }
          isPaginatingRef.current = false;
        });
      });
    }
  };

  // Partner's last read message ID
  const partnerRead = readStates.find(r => r.user_id !== user?.id);
  const partnerReadMsgId = partnerRead?.last_read_message_id;

  // Filter messages by search query if search is active
  const filteredMessages = searchQuery.trim()
    ? messages.filter(m => (m.content || '').toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : messages;

  // Count unreadable messages from previous sessions
  const unreadableCount = messages.filter(m => m.is_decrypt_error).length;

  return (
    <div className="chat-container">
      {/* Search Header Bar */}
      {isSearching && (
        <div
          className="animate-slide-up"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 16px',
            backgroundColor: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            zIndex: 20
          }}
        >
          <Search size={16} color="var(--accent-primary)" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversation..."
            autoFocus
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '13.5px'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={15} />
            </button>
          )}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="messages-scrollable"
      >
        {/* Banner for messages encrypted in previous sessions */}
        {unreadableCount > 0 && (
          <div
            className="animate-fade-in"
            style={{
              margin: '10px 14px',
              padding: '10px 14px',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              fontSize: '12px',
              color: '#fca5a5'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={16} color="#f87171" style={{ flexShrink: 0 }} />
              <span>
                {unreadableCount} message{unreadableCount > 1 ? 's were' : ' was'} encrypted in a previous session.
              </span>
            </div>
            <button
              onClick={clearUnreadableMessages}
              style={{
                background: 'rgba(239, 68, 68, 0.25)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                color: '#fff',
                cursor: 'pointer',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                whiteSpace: 'nowrap'
              }}
            >
              Clear Old
            </button>
          </div>
        )}

        {loadingMessages ? (
          <LoadingSkeleton count={6} />
        ) : filteredMessages.length === 0 ? (
          /* Empty Sanctuary State */
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '14px',
              padding: '40px 20px',
              color: 'var(--text-muted)'
            }}
          >
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
              <Heart size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>Your Private Sanctuary</h3>
              <p style={{ fontSize: '13px', marginTop: '4px', maxWidth: '280px' }}>
                Every word, photo, and memory shared here is visible only to the two of you. Say hello!
              </p>
            </div>
          </div>
        ) : (
          /* Message List with Date Separators */
          filteredMessages.map((msg, idx) => {
            const isSender = msg.sender_id === user?.id;
            const prevMsg = idx > 0 ? filteredMessages[idx - 1] : null;

            // Show date separator if day changed
            const isDifferentDay =
              !prevMsg ||
              new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();

            return (
              <React.Fragment key={msg.id}>
                {isDifferentDay && <DateSeparator dateString={msg.created_at} />}
                <ChatBubble
                  message={msg}
                  isSender={isSender}
                  reactions={reactions[msg.id] || []}
                  onReact={toggleReaction}
                  onReply={setReplyTo}
                  onDelete={deleteMsg}
                  onOpenImage={setLightboxImageUrl}
                  partnerReadMessageId={partnerReadMsgId}
                  partnerReadAt={partnerRead?.last_read_at}
                  currentUserId={user?.id}
                />
              </React.Fragment>
            );
          })
        )}
        {partnerTyping && (
          <div
            className="animate-fade-in"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              marginBottom: '6px',
              maxWidth: 'fit-content',
              borderRadius: '16px',
              backgroundColor: 'var(--bubble-bg-received)',
              border: '1px solid var(--border-subtle)',
              alignSelf: 'flex-start'
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
              Typing
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
          </div>
        )}
        <div ref={bottomAnchorRef} />
      </div>

      {/* Message Input Controls */}
      <MessageInput
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onOpenGifts={() => setShowGiftsModal(true)}
        onOpenStickers={() => setShowStickersModal(true)}
        onSelectPhotoFile={(file) => setSelectedPhotoFile(file)}
      />

      {/* Virtual Gifts Modal */}
      <VirtualGiftModal
        isOpen={showGiftsModal}
        onClose={() => setShowGiftsModal(false)}
      />

      {/* Stickers Modal */}
      <StickersModal
        isOpen={showStickersModal}
        onClose={() => setShowStickersModal(false)}
      />

      {/* Attachment Preview Modal */}
      <AttachmentModal
        file={selectedPhotoFile}
        isOpen={Boolean(selectedPhotoFile)}
        onClose={() => setSelectedPhotoFile(null)}
      />

      {/* Fullscreen Lightbox */}
      <ImageLightbox
        imageUrl={lightboxImageUrl}
        isOpen={Boolean(lightboxImageUrl)}
        onClose={() => setLightboxImageUrl(null)}
      />
    </div>
  );
}
