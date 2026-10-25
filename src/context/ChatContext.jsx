import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
import { useCrypto } from './CryptoContext';
import {
  fetchMessages,
  sendMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  fetchReactionsForMessages,
  markChatRead,
  fetchChatReadStates,
  decryptMessageRecord
} from '../services/messages';
import { uploadEncryptedChatPhoto, revokeAllDecryptedBlobUrls } from '../services/storage';
import { encryptMessage, isEncryptedMessage } from '../services/crypto';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user, profile, partnerProfile, sanctuaryChat, isAuthorized } = useAuth();
  const { conversationKey, cryptoState, setSetupModalOpen, setUnlockModalOpen } = useCrypto();

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
  const partnerTypingTimerRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  const isTypingActiveRef = useRef(false);
  const conversationKeyRef = useRef(conversationKey);

  useEffect(() => {
    conversationKeyRef.current = conversationKey;
  }, [conversationKey]);

  const chatId = sanctuaryChat?.id || '00000000-0000-0000-0000-000000000001';

  // Helper to ensure messages are strictly sorted chronologically (oldest at top, newest at bottom)
  const sortChronologically = (list) => {
    return [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  };

  // 1. Initial Load of Messages & Reactions (with Decryption)
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

        // Decrypt messages locally before storing in React state
        const decrypted = await Promise.all(
          msgs.map(m => decryptMessageRecord(m, conversationKeyRef.current))
        );

        setMessages(sortChronologically(decrypted));
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

  // 2. Re-decrypt in-memory messages whenever conversationKey becomes available (e.g. after unlock)
  useEffect(() => {
    if (!conversationKey) return;

    setMessages(prev => {
      const needsDecryption = prev.some(
        m => isEncryptedMessage(m.content) || m.is_decrypt_error || m.raw_ciphertext
      );
      if (!needsDecryption) return prev;

      Promise.all(prev.map(m => decryptMessageRecord(m, conversationKey))).then(updated => {
        setMessages(sortChronologically(updated));
      });
      return prev;
    });
  }, [conversationKey]);

  // 3. Realtime Subscriptions (Postgres changes, Presence & Low-Latency Broadcast)
  useEffect(() => {
    if (!user || !isAuthorized || !chatId) return;

    const channel = supabase.channel(`sanctuary_${chatId}`, {
      config: {
        presence: { key: user.id },
        broadcast: { self: false }
      }
    });

    channelRef.current = channel;

    // Real-time typing broadcast listener
    channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      const { userId, isTyping } = payload || {};
      if (!userId || userId === user.id) return;

      if (partnerTypingTimerRef.current) {
        clearTimeout(partnerTypingTimerRef.current);
        partnerTypingTimerRef.current = null;
      }

      if (isTyping) {
        setPartnerTyping(true);
        partnerTypingTimerRef.current = setTimeout(() => {
          setPartnerTyping(false);
        }, 2200);
      } else {
        setPartnerTyping(false);
      }
    });

    // Listen to real-time message inserts
    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const rawMsg = payload.new;
          if (!rawMsg || !rawMsg.id) return;
          if (rawMsg.chat_id && rawMsg.chat_id !== chatId) return;

          // Decrypt incoming message immediately
          const newMsg = await decryptMessageRecord(rawMsg, conversationKeyRef.current);

          const senderProfile = (newMsg.sender_id === user?.id)
            ? profile
            : (partnerProfile && partnerProfile.id === newMsg.sender_id ? partnerProfile : null);

          newMsg.profiles = newMsg.profiles || senderProfile || {
            id: newMsg.sender_id,
            display_name: newMsg.sender_id === user?.id ? 'You' : 'Partner',
            avatar_url: ''
          };

          setMessages((prev) => {
            // Check if message is already present
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

            // Check if this resolves an optimistic message
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

            return sortChronologically([...prev, newMsg]);
          });

          if (newMsg.sender_id !== user.id) {
            if (partnerTypingTimerRef.current) {
              clearTimeout(partnerTypingTimerRef.current);
              partnerTypingTimerRef.current = null;
            }
            setPartnerTyping(false);
            markChatRead(chatId, user.id, newMsg.id);
          }
        }
      )
      // Listen to real-time message updates
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        async (payload) => {
          const rawUpdated = payload.new;
          if (!rawUpdated || !rawUpdated.id) return;
          if (rawUpdated.chat_id && rawUpdated.chat_id !== chatId) return;

          const updated = await decryptMessageRecord(rawUpdated, conversationKeyRef.current);

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
      // Presence tracking
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        let otherUserOnline = false;
        Object.keys(state).forEach(key => {
          if (key !== user.id) otherUserOnline = true;
        });
        setPartnerOnline(otherUserOnline);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        if (key !== user.id) setPartnerOnline(true);
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key !== user.id) {
          setPartnerOnline(false);
          setPartnerTyping(false);
          if (partnerTypingTimerRef.current) {
            clearTimeout(partnerTypingTimerRef.current);
            partnerTypingTimerRef.current = null;
          }
        }
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          channel.track({ online_at: new Date().toISOString() }).catch(() => {});
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Subscription error on sanctuary channel:', err);
        }
      });

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (partnerTypingTimerRef.current) {
        clearTimeout(partnerTypingTimerRef.current);
        partnerTypingTimerRef.current = null;
      }
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: user.id, isTyping: false }
        }).catch(() => {});
        supabase.removeChannel(channel);
      }
      revokeAllDecryptedBlobUrls();
    };
  }, [user, isAuthorized, chatId, profile, partnerProfile]);

  // Re-synchronize messages if network was disconnected and comes back online
  useEffect(() => {
    const handleReconnected = async () => {
      if (!chatId || !user || !isAuthorized) return;
      try {
        const latest = await fetchMessages(chatId, 30);
        if (latest.length > 0) {
          const decryptedLatest = await Promise.all(
            latest.map(m => decryptMessageRecord(m, conversationKeyRef.current))
          );
          setMessages(prev => {
            const map = new Map();
            prev.filter(m => m.id?.toString().startsWith('temp_')).forEach(m => map.set(m.id, m));
            prev.forEach(m => map.set(m.id, m));
            decryptedLatest.forEach(m => map.set(m.id, { ...map.get(m.id), ...m }));
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

  // Broadcast typing status with throttling
  const broadcastTyping = useCallback((isTyping) => {
    if (!channelRef.current || !user) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    const now = Date.now();

    if (!isTyping) {
      if (isTypingActiveRef.current) {
        isTypingActiveRef.current = false;
        lastTypingSentRef.current = 0;
        channelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: user.id, isTyping: false }
        }).catch(() => {});
      }
      return;
    }

    if (!isTypingActiveRef.current || now - lastTypingSentRef.current > 1500) {
      isTypingActiveRef.current = true;
      lastTypingSentRef.current = now;
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, isTyping: true }
      }).catch(() => {});
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingActiveRef.current = false;
      lastTypingSentRef.current = 0;
      channelRef.current?.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, isTyping: false }
      }).catch(() => {});
    }, 2000);
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
        const decryptedOlder = await Promise.all(
          older.map(m => decryptMessageRecord(m, conversationKeyRef.current))
        );
        setMessages(prev => sortChronologically([...decryptedOlder, ...prev]));
        const olderRx = await fetchReactionsForMessages(older.map(m => m.id));
        setReactions(prev => ({ ...prev, ...olderRx }));
      }
    } catch (err) {
      console.error('Failed to load older messages:', err);
    }
  };

  // ---------------------------------------------------------------------------
  // Send End-to-End Encrypted Text Message
  // ---------------------------------------------------------------------------
  const sendTextMessage = async (text, replyTo = null) => {
    if (!text || !text.trim() || !user) return;
    broadcastTyping(false);

    // CRITICAL SECURITY GUARD: Never send plaintext as fallback
    if (!conversationKey || cryptoState !== 'ready') {
      if (cryptoState === 'locked') setUnlockModalOpen(true);
      else if (cryptoState === 'uninitialized') setSetupModalOpen(true);
      throw new Error('E2EE key is unavailable. Plaintext message transmission is strictly blocked.');
    }

    const trimmed = text.trim();
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Build sensitive payload (text + reply quote)
    const payload = {
      text: trimmed,
      reply_to: replyTo ? { sender_name: replyTo.sender_name, content: replyTo.content } : null
    };

    // Encrypt payload before anything leaves the client
    const ciphertext = await encryptMessage(payload, conversationKey, 'epoch_1');

    // Optimistic message: Plaintext kept in local memory only for the sender
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
      is_encrypted: true,
      status: 'sending',
      created_at: new Date().toISOString(),
      profiles: profile
    };

    setMessages(prev => sortChronologically([...prev, optimisticMsg]));

    try {
      // Send only ciphertext to database.
      // Notice: reply_to snippet is omitted from metadata to prevent leaks in DB!
      const sentMsg = await sendMessage({
        chatId,
        senderId: user.id,
        content: ciphertext,
        type: 'text',
        metadata: {
          client_temp_id: tempId
        }
      });

      setMessages(prev => {
        if (prev.some(m => m.id === sentMsg.id)) {
          return prev.filter(m => m.id !== tempId);
        }
        return sortChronologically(prev.map(m => m.id === tempId ? {
          ...sentMsg,
          content: trimmed, // Retain readable text in local state
          metadata: {
            ...(replyTo ? { reply_to: replyTo } : {}),
            ...sentMsg.metadata
          },
          is_encrypted: true,
          profiles: sentMsg.profiles || profile
        } : m));
      });
    } catch (err) {
      console.error('Send message failed:', err);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
      throw err;
    }
  };

  // ---------------------------------------------------------------------------
  // Send End-to-End Encrypted Photo Message
  // ---------------------------------------------------------------------------
  const sendPhotoMessage = async (file, caption = '') => {
    if (!file || !user) return;
    broadcastTyping(false);

    // CRITICAL SECURITY GUARD: Never upload plaintext as fallback
    if (!conversationKey || cryptoState !== 'ready') {
      if (cryptoState === 'locked') setUnlockModalOpen(true);
      else if (cryptoState === 'uninitialized') setSetupModalOpen(true);
      throw new Error('E2EE key is unavailable. Plaintext photo upload is strictly blocked.');
    }

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
      is_encrypted: true,
      status: 'sending',
      created_at: new Date().toISOString(),
      profiles: profile
    };

    setMessages(prev => sortChronologically([...prev, optimisticMsg]));

    try {
      // 1. Encrypt and upload image bytes to private bucket (ciphertext only)
      const { path } = await uploadEncryptedChatPhoto(file, chatId, user.id, conversationKey);

      // 2. Encrypt caption and path inside message payload
      const photoPayload = {
        caption: caption || '',
        photo_path: path
      };
      const ciphertext = await encryptMessage(photoPayload, conversationKey, 'epoch_1');

      // 3. Send ciphertext message record
      const msg = await sendMessage({
        chatId,
        senderId: user.id,
        content: ciphertext,
        type: 'image',
        metadata: {
          photo_path: path,
          client_temp_id: tempId
        }
      });

      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) {
          return prev.filter(m => m.id !== tempId);
        }
        return sortChronologically(prev.map(m => m.id === tempId ? {
          ...msg,
          content: caption || '',
          metadata: {
            photo_path: path,
            signed_url: localPreviewUrl,
            client_temp_id: tempId
          },
          is_encrypted: true,
          profiles: msg.profiles || profile
        } : m));
      });
      return msg;
    } catch (err) {
      console.error('Photo message failed:', err);
      setUploadError(err.message || 'Failed to upload encrypted photo.');
      setMessages(prev => prev.filter(m => m.id !== tempId));
      throw err;
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Send End-to-End Encrypted Virtual Gift Message
  // ---------------------------------------------------------------------------
  const sendGiftMessage = async (gift) => {
    if (!gift || !user) return;
    broadcastTyping(false);

    if (!conversationKey || cryptoState !== 'ready') {
      if (cryptoState === 'locked') setUnlockModalOpen(true);
      else if (cryptoState === 'uninitialized') setSetupModalOpen(true);
      throw new Error('E2EE key is unavailable. Plaintext message transmission is strictly blocked.');
    }

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const giftMetadata = {
      gift_id: gift.id,
      title: gift.title,
      emoji: gift.emoji,
      message: gift.message,
      color: gift.color
    };

    const payload = {
      gift: giftMetadata,
      text: gift.title
    };
    const ciphertext = await encryptMessage(payload, conversationKey, 'epoch_1');

    const optimisticMsg = {
      id: tempId,
      chat_id: chatId,
      sender_id: user.id,
      content: gift.title,
      type: 'gift',
      metadata: {
        ...giftMetadata,
        client_temp_id: tempId
      },
      is_deleted: false,
      is_encrypted: true,
      status: 'sending',
      created_at: new Date().toISOString(),
      profiles: profile
    };

    setMessages(prev => sortChronologically([...prev, optimisticMsg]));

    try {
      const msg = await sendMessage({
        chatId,
        senderId: user.id,
        content: ciphertext,
        type: 'gift',
        metadata: {
          gift_id: gift.id,
          client_temp_id: tempId
        }
      });

      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) {
          return prev.filter(m => m.id !== tempId);
        }
        return sortChronologically(prev.map(m => m.id === tempId ? {
          ...msg,
          content: gift.title,
          metadata: {
            ...giftMetadata,
            client_temp_id: tempId
          },
          is_encrypted: true,
          profiles: msg.profiles || profile
        } : m));
      });
      return msg;
    } catch (err) {
      console.error('Gift sending failed:', err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      throw err;
    }
  };

  // ---------------------------------------------------------------------------
  // Send End-to-End Encrypted Sticker Message
  // ---------------------------------------------------------------------------
  const sendStickerMessage = async (sticker) => {
    if (!sticker || !user) return;
    broadcastTyping(false);

    if (!conversationKey || cryptoState !== 'ready') {
      if (cryptoState === 'locked') setUnlockModalOpen(true);
      else if (cryptoState === 'uninitialized') setSetupModalOpen(true);
      throw new Error('E2EE key is unavailable. Plaintext message transmission is strictly blocked.');
    }

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const stickerMetadata = {
      sticker_id: sticker.id,
      emoji: sticker.emoji,
      label: sticker.label
    };

    const payload = {
      sticker: stickerMetadata,
      text: sticker.label
    };
    const ciphertext = await encryptMessage(payload, conversationKey, 'epoch_1');

    const optimisticMsg = {
      id: tempId,
      chat_id: chatId,
      sender_id: user.id,
      content: sticker.label,
      type: 'sticker',
      metadata: {
        ...stickerMetadata,
        client_temp_id: tempId
      },
      is_deleted: false,
      is_encrypted: true,
      status: 'sending',
      created_at: new Date().toISOString(),
      profiles: profile
    };

    setMessages(prev => sortChronologically([...prev, optimisticMsg]));

    try {
      const msg = await sendMessage({
        chatId,
        senderId: user.id,
        content: ciphertext,
        type: 'sticker',
        metadata: {
          sticker_id: sticker.id,
          client_temp_id: tempId
        }
      });

      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) {
          return prev.filter(m => m.id !== tempId);
        }
        return sortChronologically(prev.map(m => m.id === tempId ? {
          ...msg,
          content: sticker.label,
          metadata: {
            ...stickerMetadata,
            client_temp_id: tempId
          },
          is_encrypted: true,
          profiles: msg.profiles || profile
        } : m));
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
      const decrypted = await Promise.all(msgs.map(m => decryptMessageRecord(m, conversationKeyRef.current)));
      setMessages(sortChronologically(decrypted));
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
