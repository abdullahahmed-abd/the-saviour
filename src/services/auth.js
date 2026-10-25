import { supabase } from './supabase';

/**
 * Log in with email and password
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });
  if (error) throw error;
  return data;
}

/**
 * Log out of current session
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Send password reset email
 */
export async function resetPassword(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/reset-password`
  });
  if (error) throw error;
  return data;
}

/**
 * Update password (after reset)
 */
export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  });
  if (error) throw error;
  return data;
}

/**
 * Check if the user is authorized in the 2-member whitelist
 */
export async function checkUserAuthorization(userId, email) {
  try {
    const { data, error } = await supabase
      .from('authorized_users')
      .select('id, email, user_id')
      .or(`user_id.eq.${userId},email.eq.${email.toLowerCase()}`)
      .maybeSingle();

    if (error) {
      console.warn('Authorization check query error:', error.message);
      return false;
    }

    return Boolean(data);
  } catch (err) {
    console.warn('Authorization verification check error:', err);
    return false;
  }
}

/**
 * Fetch profile for a given user ID
 */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update user's profile
 */
export async function updateProfile(userId, { displayName, avatarUrl, statusMessage }) {
  const updates = {
    updated_at: new Date().toISOString()
  };
  if (displayName !== undefined) updates.display_name = displayName;
  if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;
  if (statusMessage !== undefined) updates.status_message = statusMessage;

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get or initialize the Sanctuary Chat and load members
 */
export async function getSanctuaryChat(currentUserId) {
  // Ensure the default sanctuary chat exists
  const defaultChatId = '00000000-0000-0000-0000-000000000001';
  
  let { data: chat, error } = await supabase
    .from('chats')
    .select('*')
    .eq('id', defaultChatId)
    .maybeSingle();

  if (!chat) {
    const { data: newChat, error: createError } = await supabase
      .from('chats')
      .upsert({ id: defaultChatId, name: 'The Saviour Sanctuary' })
      .select()
      .single();
    if (createError) throw createError;
    chat = newChat;
  }

  // Ensure current user is in chat_members
  if (currentUserId) {
    await supabase
      .from('chat_members')
      .upsert(
        { chat_id: defaultChatId, user_id: currentUserId },
        { onConflict: 'chat_id, user_id' }
      );
  }

  // Fetch all members of this sanctuary
  const { data: members } = await supabase
    .from('chat_members')
    .select('user_id, profiles(id, display_name, avatar_url, status_message, last_seen)')
    .eq('chat_id', defaultChatId);

  const parsedMembers = (members || []).map(m => m.profiles).filter(Boolean);
  const partner = parsedMembers.find(p => p.id !== currentUserId) || null;

  return {
    chat,
    members: parsedMembers,
    partner
  };
}
