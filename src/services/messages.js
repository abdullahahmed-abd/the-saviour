import { supabase } from './supabase';

/**
 * Fetch messages with pagination
 */
export async function fetchMessages(chatId, limit = 50, beforeTimestamp = null) {
  let query = supabase
    .from('messages')
    .select(`
      id,
      chat_id,
      sender_id,
      content,
      type,
      metadata,
      is_deleted,
      status,
      created_at,
      profiles:sender_id (id, display_name, avatar_url)
    `)
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (beforeTimestamp) {
    query = query.lt('created_at', beforeTimestamp);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Reverse so older is at top, newer at bottom
  return (data || []).reverse();
}

/**
 * Send a message
 */
export async function sendMessage({ chatId, senderId, content, type = 'text', metadata = {} }) {
  if (!content && type === 'text') {
    throw new Error('Message cannot be empty');
  }

  const payload = {
    chat_id: chatId,
    sender_id: senderId,
    content: content ? content.trim() : '',
    type,
    metadata,
    status: 'sent'
  };

  const { data, error } = await supabase
    .from('messages')
    .insert(payload)
    .select(`
      id,
      chat_id,
      sender_id,
      content,
      type,
      metadata,
      is_deleted,
      status,
      created_at,
      profiles:sender_id (id, display_name, avatar_url)
    `)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Soft delete or hard delete a message
 */
export async function deleteMessage(messageId, hardDelete = false) {
  if (hardDelete) {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('messages')
      .update({
        is_deleted: true,
        content: 'This message was deleted'
      })
      .eq('id', messageId);
    if (error) throw error;
  }
}

/**
 * Add an emoji reaction to a message
 */
export async function addReaction(messageId, userId, emoji) {
  const { data, error } = await supabase
    .from('message_reactions')
    .upsert(
      { message_id: messageId, user_id: userId, emoji },
      { onConflict: 'message_id, user_id, emoji' }
    )
    .select();

  if (error) throw error;
  return data;
}

/**
 * Remove an emoji reaction
 */
export async function removeReaction(messageId, userId, emoji) {
  const { error } = await supabase
    .from('message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('emoji', emoji);

  if (error) throw error;
}

/**
 * Fetch reactions for a list of message IDs
 */
export async function fetchReactionsForMessages(messageIds) {
  if (!messageIds || messageIds.length === 0) return {};

  const { data, error } = await supabase
    .from('message_reactions')
    .select('id, message_id, user_id, emoji')
    .in('message_id', messageIds);

  if (error) throw error;

  // Group by message_id
  const grouped = {};
  (data || []).forEach(r => {
    if (!grouped[r.message_id]) grouped[r.message_id] = [];
    grouped[r.message_id].push(r);
  });

  return grouped;
}

/**
 * Mark sanctuary chat messages as read for current user
 */
export async function markChatRead(chatId, userId, lastMessageId) {
  if (!chatId || !userId) return;

  const { error } = await supabase
    .from('message_reads')
    .upsert(
      {
        chat_id: chatId,
        user_id: userId,
        last_read_message_id: lastMessageId,
        last_read_at: new Date().toISOString()
      },
      { onConflict: 'chat_id, user_id' }
    );

  if (error) console.warn('Could not update read state:', error.message);
}

/**
 * Fetch read states for the chat
 */
export async function fetchChatReadStates(chatId) {
  const { data, error } = await supabase
    .from('message_reads')
    .select('user_id, last_read_message_id, last_read_at')
    .eq('chat_id', chatId);

  if (error) {
    console.warn('Could not fetch read states:', error.message);
    return [];
  }
  return data || [];
}
