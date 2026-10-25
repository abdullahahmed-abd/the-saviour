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
import { Heart, Search, X, Shield, Sparkles } from 'lucide-react';

export default function Chat({ isSearching, onToggleSearch }) {
  const { user } = useAuth();
  const {
    messages,
    reactions,
    readStates,
    loadingMessages,
    hasMoreMessages,
    loadMoreMessages,
    toggleReaction,
    deleteMsg,
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

  // Auto scroll to bottom on new message if user is at bottom
  useEffect(() => {
    if (isAtBottomRef.current && bottomAnchorRef.current) {
      bottomAnchorRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    markChatRead();
  }, [messages.length, markChatRead]);

  const handleScroll = (e) => {
    const target = e.target;
    // Check if near top to trigger load older messages
    if (target.scrollTop < 50 && hasMoreMessages && !loadingMessages) {
      loadMoreMessages();
    }
    // Check if user is near bottom
    const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    isAtBottomRef.current = distanceToBottom < 100;
  };

  // Partner's last read message ID
  const partnerRead = readStates.find(r => r.user_id !== user?.id);
  const partnerReadMsgId = partnerRead?.last_read_message_id;

  // Filter messages by search query if search is active
  const filteredMessages = searchQuery.trim()
    ? messages.filter(m => (m.content || '').toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : messages;

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
                  currentUserId={user?.id}
                />
              </React.Fragment>
            );
          })
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
