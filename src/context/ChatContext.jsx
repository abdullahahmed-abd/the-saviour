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
  const { user, profile, partnerProfile, sanctuaryChat, isAuthorized } = useAuth();
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

  // Helper to ensure messages are strictly sorted chronologically (oldest at top, newest at bottom)
  const sortChronologically = (list) => {
    return [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  };

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

        setMessages(sortChronologically(msgs));
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
    if (!user || !isAuthorized || !chatId) return;

    // Join channel for the sanctuary chat room
    const channel = supabase.channel(`sanctuary_${chatId}`, {
      config: {
        presence: { key: user.id }
      }
    });

    channelRef.current = channel;

    // Listen to real-time message inserts
    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new;
          if (!newMsg || !newMsg.id) return;
          // Filter to the current sanctuary room
          if (newMsg.chat_id && newMsg.chat_id !== chatId) return;

          // Attach sender profile immediately from auth context without network delay
          const senderProfile = (newMsg.sender_id === user?.id)
            ? profile
            : (partnerProfile && partnerProfile.id === newMsg.sender_id ? partnerProfile : null);

          newMsg.profiles = newMsg.profiles || senderProfile || {
            id: newMsg.sender_id,
            display_name: newMsg.sender_id === user?.id ? 'You' : 'Partner',
            avatar_url: ''
          };

          setMessages((prev) => {
            // 1. Check if the message is already present by exact database message ID
            const existingIndex = prev.findIndex(m => m.id === newMsg.id);
            if (existingIndex !== -1) {
              const updated = [...prev];
              updated[existingIndex] = {
                ...updated[existingIndex],
                ...newMsg,
                profiles: newMsg.profiles || updated[existingIndex].profiles,
                status: 'sent'
              };
              return updated;
            }

            // 2. Check if this resolves an optimistic message (by client temp ID or content matching)
            const clientTempId = newMsg.metadata?.client_temp_id;
            const tempIndex = prev.findIndex(m => {
              if (clientTempId && (m.id === clientTempId || m.metadata?.client_temp_id === clientTempId)) {
                return true;
              }
              return (
                m.id?.toString().startsWith('temp_') &&
                m.sender_id === newMsg.sender_id &&
                m.content === newMsg.content &&
                m.type === newMsg.type
              );
            });

            if (tempIndex !== -1) {
              const updated = [...prev];
              updated[tempIndex] = {
                ...updated[tempIndex],
                ...newMsg,
                profiles: newMsg.profiles || updated[tempIndex].profiles,
                status: 'sent'
              };
              return sortChronologically(updated);
            }

            // 3. Otherwise, append new message and sort chronologically
            return sortChronologically([...prev, newMsg]);
          });

          // Play sound chime if received from partner
          if (newMsg.sender_id !== user.id) {
            playReceiveChime();
            // Automatically mark read
            markChatRead(chatId, user.id, newMsg.id);
          }
        }
      )
      // Listen to real-time message updates (e.g. edits, soft deletes)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const updated = payload.new;
          if (!updated || !updated.id) return;
          if (updated.chat_id && updated.chat_id !== chatId) return;

          setMessages(prev => prev.map(m => {
            if (m.id === updated.id) {
              return {
                ...m,
                ...updated,
                profiles: updated.profiles || m.profiles
              };
            }
            return m;
          }));
        }
      )
      // Listen to real-time message deletes
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          const deletedId = payload.old?.id;
          if (!deletedId) return;
          setMessages(prev => prev.filter(m => m.id !== deletedId));
        }
      )
      // Reactions realtime (INSERT)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const rx = payload.new;
          if (!rx || !rx.id) return;
          setReactions(prev => {
            const list = prev[rx.message_id] || [];
            if (list.some(r => r.id === rx.id)) return prev;
            return { ...prev, [rx.message_id]: [...list, rx] };
          });
        }
      )
      // Reactions realtime (DELETE)
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const oldRx = payload.old;
          if (!oldRx || !oldRx.id) return;
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
        { event: '*', schema: 'public', table: 'message_reads' },
        async (payload) => {
          if (payload.new?.chat_id && payload.new.chat_id !== chatId) return;
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
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          channel.track({
            online_at: new Date().toISOString(),
            typing: false
          }).catch(() => {});
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Subscription error on sanctuary channel:', err);
        } else if (status === 'TIMED_OUT') {
          console.warn('[Realtime] Subscription timed out on sanctuary channel');
        }
      });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user, isAuthorized, chatId, profile, partnerProfile]);

  // Re-synchronize messages if network was disconnected and comes back online
  useEffect(() => {
    const handleReconnected = async () => {
      if (!chatId || !user || !isAuthorized) return;
      try {
        const latest = await fetchMessages(chatId, 30);
        if (latest.length > 0) {
          setMessages(prev => {
            const map = new Map();
            // Retain pending optimistic messages
            prev.filter(m => m.id?.toString().startsWith('temp_')).forEach(m => map.set(m.id, m));
            // Keep existing confirmed messages
            prev.forEach(m => map.set(m.id, m));
            // Merge in latest messages from server
            latest.forEach(m => map.set(m.id, { ...map.get(m.id), ...m }));
            return sortChronologically(Array.from(map.values()));
          });
        }
      } catch (e) {
        console.warn('Re-sync on reconnect error:', e);
      }
    };

    window.addEventListener('online', handleReconnected);
    return () => window.removeEventListener('online', handleReconnected);
  }, [chatId, user, isAuthorized]);

  // Broadcast typing status
  const broadcastTyping = useCallback((isTyping) => {
    if (!channelRef.current || !user) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    channelRef.current.track({
      online_at: new Date().toISOString(),
      typing: isTyping
    }).catch(() => {});

    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        channelRef.current?.track({
          online_at: new Date().toISOString(),
          typing: false
        }).catch(() => {});
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
        setMessages(prev => sortChronologically([...older, ...prev]));
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

    const trimmed = text.trim();
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const optimisticMsg = {
      id: tempId,
      chat_id: chatId,
      sender_id: user.id,
      content: trimmed,
      type: 'text',
      metadata: {
        ...(replyTo ? { reply_to: replyTo } : {}),
        client_temp_id: tempId
      },
      is_deleted: false,
      status: 'sending',
      created_at: new Date().toISOString(),
      profiles: profile
    };

    setMessages(prev => sortChronologically([...prev, optimisticMsg]));
    playSendChime();
    broadcastTyping(false);

    try {
      const sentMsg = await sendMessage({
        chatId,
        senderId: user.id,
        content: trimmed,
        type: 'text',
        metadata: {
          ...(replyTo ? { reply_to: replyTo } : {}),
          client_temp_id: tempId
        }
      });

      setMessages(prev => {
        // If the real message already arrived via Realtime, remove the optimistic temp message
        if (prev.some(m => m.id === sentMsg.id)) {
          return prev.filter(m => m.id !== tempId);
        }
        // Otherwise replace tempId with sentMsg
        return sortChronologically(prev.map(m => m.id === tempId ? { ...sentMsg, profiles: sentMsg.profiles || profile } : m));
      });
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

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const localPreviewUrl = URL.createObjectURL(file);
    const optimisticMsg = {
      id: tempId,
      chat_id: chatId,
      sender_id: user.id,
      content: caption || '',
      type: 'image',
      metadata: {
        photo_path: '',
        signed_url: localPreviewUrl,
        client_temp_id: tempId
      },
      is_deleted: false,
      status: 'sending',
      created_at: new Date().toISOString(),
      profiles: profile
    };

    setMessages(prev => sortChronologically([...prev, optimisticMsg]));

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
          signed_url: signedUrl,
          client_temp_id: tempId
        }
      });

      playSendChime();
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) {
          return prev.filter(m => m.id !== tempId);
        }
        return sortChronologically(prev.map(m => m.id === tempId ? { ...msg, profiles: msg.profiles || profile } : m));
      });
      return msg;
    } catch (err) {
      console.error('Photo message failed:', err);
      setUploadError(err.message || 'Failed to upload photo.');
      setMessages(prev => prev.filter(m => m.id !== tempId));
      throw err;
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Send a virtual gift card message
  const sendGiftMessage = async (gift) => {
    if (!gift || !user) return;
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const giftMetadata = {
      gift_id: gift.id,
      title: gift.title,
      emoji: gift.emoji,
      message: gift.message,
      color: gift.color,
      client_temp_id: tempId
    };
    const optimisticMsg = {
      id: tempId,
      chat_id: chatId,
      sender_id: user.id,
      content: gift.title,
      type: 'gift',
      metadata: giftMetadata,
      is_deleted: false,
      status: 'sending',
      created_at: new Date().toISOString(),
      profiles: profile
    };

    setMessages(prev => sortChronologically([...prev, optimisticMsg]));
    playSendChime();

    try {
      const msg = await sendMessage({
        chatId,
        senderId: user.id,
        content: gift.title,
        type: 'gift',
        metadata: giftMetadata
      });

      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) {
          return prev.filter(m => m.id !== tempId);
        }
        return sortChronologically(prev.map(m => m.id === tempId ? { ...msg, profiles: msg.profiles || profile } : m));
      });
      return msg;
    } catch (err) {
      console.error('Gift sending failed:', err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      throw err;
    }
  };

  // Send a built-in expressive sticker
  const sendStickerMessage = async (sticker) => {
    if (!sticker || !user) return;
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const stickerMetadata = {
      sticker_id: sticker.id,
      emoji: sticker.emoji,
      label: sticker.label,
      client_temp_id: tempId
    };
    const optimisticMsg = {
      id: tempId,
      chat_id: chatId,
      sender_id: user.id,
      content: sticker.label,
      type: 'sticker',
      metadata: stickerMetadata,
      is_deleted: false,
      status: 'sending',
      created_at: new Date().toISOString(),
      profiles: profile
    };

    setMessages(prev => sortChronologically([...prev, optimisticMsg]));
    playSendChime();

    try {
      const msg = await sendMessage({
        chatId,
        senderId: user.id,
        content: sticker.label,
        type: 'sticker',
        metadata: stickerMetadata
      });

      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) {
          return prev.filter(m => m.id !== tempId);
        }
        return sortChronologically(prev.map(m => m.id === tempId ? { ...msg, profiles: msg.profiles || profile } : m));
      });
      return msg;
    } catch (err) {
      console.error('Sticker message failed:', err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      throw err;
    }
  };

  // Soft delete own message
  const deleteMsg = async (messageId) => {
    try {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_deleted: true, content: 'This message was deleted' } : m));
      await deleteMessage(messageId, false);
    } catch (err) {
      console.error('Delete message error:', err);
      const msgs = await fetchMessages(chatId, 50);
      setMessages(sortChronologically(msgs));
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
        setReactions(prev => ({
          ...prev,
          [messageId]: (prev[messageId] || []).filter(r => r.id !== existing.id)
        }));
        await removeReaction(messageId, user.id, emoji);
      } else {
        const tempReactionId = `temp_rx_${Date.now()}`;
        setReactions(prev => ({
          ...prev,
          [messageId]: [...(prev[messageId] || []), { id: tempReactionId, message_id: messageId, user_id: user.id, emoji }]
        }));
        const added = await addReaction(messageId, user.id, emoji);
        if (added && added[0]) {
          setReactions(prev => ({
            ...prev,
            [messageId]: (prev[messageId] || []).map(r => r.id === tempReactionId ? added[0] : r)
          }));
        }
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
