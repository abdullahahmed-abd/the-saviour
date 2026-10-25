import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
import {
  fetchMessages,
  sendMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  fetchReactionsForMessages,
  markChatRead,
  fetchChatReadStates
} from '../services/messages';
import { uploadChatPhoto } from '../services/storage';
import { playSendChime, playReceiveChime } from '../utils/sound';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user, profile, sanctuaryChat, isAuthorized } = useAuth();
  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState({});
  const [readStates, setReadStates] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const channelRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const chatId = sanctuaryChat?.id || '00000000-0000-0000-0000-000000000001';

  // 1. Initial Load of Messages & Reactions
  useEffect(() => {
    if (!user || !isAuthorized) {
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    let isMounted = true;

    async function loadInitial() {
      setLoadingMessages(true);
      try {
        const msgs = await fetchMessages(chatId, 50);
        if (!isMounted) return;

        setMessages(msgs);
        if (msgs.length < 50) {
          setHasMoreMessages(false);
        }

        // Load reactions
        const msgIds = msgs.map(m => m.id);
        const rx = await fetchReactionsForMessages(msgIds);
        if (isMounted) setReactions(rx);

        // Load read states
        const reads = await fetchChatReadStates(chatId);
        if (isMounted) setReadStates(reads);

        // Mark read for current user
        if (msgs.length > 0) {
          const lastMsg = msgs[msgs.length - 1];
          await markChatRead(chatId, user.id, lastMsg.id);
        }
      } catch (err) {
        console.error('Error loading initial chat messages:', err);
      } finally {
        if (isMounted) setLoadingMessages(false);
      }
    }

    loadInitial();

    return () => {
      isMounted = false;
    };
  }, [user, isAuthorized, chatId]);

  // 2. Realtime Subscriptions (Postgres changes & Presence)
  useEffect(() => {
    if (!user || !isAuthorized) return;

    // Join channel
    const channel = supabase.channel(`sanctuary_${chatId}`, {
      config: {
        presence: { key: user.id }
      }
    });

    channelRef.current = channel;

    // Listen to message inserts & updates
    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        async (payload) => {
          const newMsg = payload.new;

          // Check if sender profile is present; if not, query it
          if (!newMsg.profiles && newMsg.sender_id) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('id, display_name, avatar_url')
              .eq('id', newMsg.sender_id)
              .single();
            newMsg.profiles = prof;
          }

          setMessages(prev => {
            // Avoid duplicate optimistic insert
            const exists = prev.some(m => m.id === newMsg.id);
            if (exists) {
              return prev.map(m => m.id === newMsg.id ? newMsg : m);
            }
            return [...prev, newMsg];
          });

          // Play sound chime if received from partner
          if (newMsg.sender_id !== user.id) {
            playReceiveChime();
            // Automatically mark read
            markChatRead(chatId, user.id, newMsg.id);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const updated = payload.new;
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const deletedId = payload.old.id;
          setMessages(prev => prev.filter(m => m.id !== deletedId));
        }
      )
      // Reactions realtime
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const rx = payload.new;
          setReactions(prev => {
            const list = prev[rx.message_id] || [];
            if (list.some(r => r.id === rx.id)) return prev;
            return { ...prev, [rx.message_id]: [...list, rx] };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const oldRx = payload.old;
          setReactions(prev => {
            const list = prev[oldRx.message_id] || [];
            return {
              ...prev,
              [oldRx.message_id]: list.filter(r => r.id !== oldRx.id)
            };
          });
        }
      )
      // Read state updates
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reads', filter: `chat_id=eq.${chatId}` },
        async () => {
          const reads = await fetchChatReadStates(chatId);
          setReadStates(reads);
        }
      )
      // Presence tracking (Partner Online & Typing)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        let otherUserOnline = false;
        let otherUserTyping = false;

        Object.keys(state).forEach(key => {
          if (key !== user.id) {
            otherUserOnline = true;
            const presences = state[key];
            if (presences?.some(p => p.typing)) {
              otherUserTyping = true;
            }
          }
        });

        setPartnerOnline(otherUserOnline);
        setPartnerTyping(otherUserTyping);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        if (key !== user.id) setPartnerOnline(true);
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key !== user.id) {
          setPartnerOnline(false);
          setPartnerTyping(false);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online_at: new Date().toISOString(),
            typing: false
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAuthorized, chatId]);

  // Broadcast typing status
  const broadcastTyping = useCallback((isTyping) => {
    if (!channelRef.current || !user) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    channelRef.current.track({
      online_at: new Date().toISOString(),
      typing: isTyping
    });

    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        channelRef.current?.track({
          online_at: new Date().toISOString(),
          typing: false
        });
      }, 3000);
    }
  }, [user]);

  // Load older messages for pagination
  const loadMoreMessages = async () => {
    if (loadingMessages || !hasMoreMessages || messages.length === 0) return;
    const oldestTimestamp = messages[0].created_at;

    try {
      const older = await fetchMessages(chatId, 30, oldestTimestamp);
      if (older.length < 30) {
        setHasMoreMessages(false);
      }
      if (older.length > 0) {
        setMessages(prev => [...older, ...prev]);
        const olderRx = await fetchReactionsForMessages(older.map(m => m.id));
        setReactions(prev => ({ ...prev, ...olderRx }));
      }
    } catch (err) {
      console.error('Failed to load older messages:', err);
    }
  };

  // Send a regular text message (Optimistic update)
  const sendTextMessage = async (text, replyTo = null) => {
    if (!text || !text.trim() || !user) return;

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      chat_id: chatId,
      sender_id: user.id,
      content: text.trim(),
      type: 'text',
      metadata: replyTo ? { reply_to: replyTo } : {},
      is_deleted: false,
      status: 'sending',
      created_at: new Date().toISOString(),
      profiles: profile
    };

    setMessages(prev => [...prev, optimisticMsg]);
    playSendChime();
    broadcastTyping(false);

    try {
      const sentMsg = await sendMessage({
        chatId,
        senderId: user.id,
        content: text.trim(),
        type: 'text',
        metadata: replyTo ? { reply_to: replyTo } : {}
      });

      setMessages(prev => prev.map(m => m.id === tempId ? sentMsg : m));
    } catch (err) {
      console.error('Send message failed:', err);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
      throw err;
    }
  };

  // Send a private photo message
  const sendPhotoMessage = async (file, caption = '') => {
    if (!file || !user) return;
    setUploadingPhoto(true);
    setUploadError(null);

    try {
      // Upload to private bucket
      const { path, signedUrl } = await uploadChatPhoto(file, chatId, user.id);

      const msg = await sendMessage({
        chatId,
        senderId: user.id,
        content: caption || '',
        type: 'image',
        metadata: {
          photo_path: path,
          signed_url: signedUrl
        }
      });

      playSendChime();
      return msg;
    } catch (err) {
      console.error('Photo message failed:', err);
      setUploadError(err.message || 'Failed to upload photo.');
      throw err;
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Send a virtual gift card message
  const sendGiftMessage = async (gift) => {
    if (!gift || !user) return;
    try {
      const msg = await sendMessage({
        chatId,
        senderId: user.id,
        content: gift.title,
        type: 'gift',
        metadata: {
          gift_id: gift.id,
          title: gift.title,
          emoji: gift.emoji,
          message: gift.message,
          color: gift.color
        }
      });
      playSendChime();
      return msg;
    } catch (err) {
      console.error('Gift sending failed:', err);
      throw err;
    }
  };

  // Send a built-in expressive sticker
  const sendStickerMessage = async (sticker) => {
    if (!sticker || !user) return;
    try {
      const msg = await sendMessage({
        chatId,
        senderId: user.id,
        content: sticker.label,
        type: 'sticker',
        metadata: {
          sticker_id: sticker.id,
          emoji: sticker.emoji,
          label: sticker.label
        }
      });
      playSendChime();
      return msg;
    } catch (err) {
      console.error('Sticker message failed:', err);
      throw err;
    }
  };

  // Soft delete own message
  const deleteMsg = async (messageId) => {
    try {
      await deleteMessage(messageId, false);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_deleted: true, content: 'This message was deleted' } : m));
    } catch (err) {
      console.error('Delete message error:', err);
      throw err;
    }
  };

  // Toggle emoji reaction
  const toggleReaction = async (messageId, emoji) => {
    if (!user) return;
    const msgReactions = reactions[messageId] || [];
    const existing = msgReactions.find(r => r.user_id === user.id && r.emoji === emoji);

    try {
      if (existing) {
        await removeReaction(messageId, user.id, emoji);
        setReactions(prev => ({
          ...prev,
          [messageId]: (prev[messageId] || []).filter(r => r.id !== existing.id)
        }));
      } else {
        const added = await addReaction(messageId, user.id, emoji);
        setReactions(prev => ({
          ...prev,
          [messageId]: [...(prev[messageId] || []), added[0] || { message_id: messageId, user_id: user.id, emoji }]
        }));
      }
    } catch (err) {
      console.error('Reaction toggle error:', err);
    }
  };

  const value = {
    messages,
    reactions,
    readStates,
    loadingMessages,
    hasMoreMessages,
    partnerTyping,
    partnerOnline,
    uploadingPhoto,
    uploadError,
    loadMoreMessages,
    sendTextMessage,
    sendPhotoMessage,
    sendGiftMessage,
    sendStickerMessage,
    deleteMsg,
    toggleReaction,
    broadcastTyping,
    markChatRead: () => {
      if (messages.length > 0 && user) {
        markChatRead(chatId, user.id, messages[messages.length - 1].id);
      }
    }
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
