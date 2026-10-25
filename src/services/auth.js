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

  // Fetch all members of this sanctuary first
  let { data: members, error: membersError } = await supabase
    .from('chat_members')
    .select('user_id, profiles(id, display_name, avatar_url, status_message, last_seen)')
    .eq('chat_id', defaultChatId);

  if (membersError) {
    console.error('Failed to fetch chat members:', membersError.message);
  }

  const memberList = members || [];
  const isAlreadyMember = currentUserId && memberList.some(m => m.user_id === currentUserId);

  // If user is not yet a member and sanctuary has space (< 2 members), join cleanly
  if (currentUserId && !isAlreadyMember && memberList.length < 2) {
    const { error: joinError } = await supabase
      .from('chat_members')
      .insert({ chat_id: defaultChatId, user_id: currentUserId });

    if (joinError) {
      // 23505 is PostgreSQL unique_violation (in case of concurrent insert)
      if (joinError.code !== '23505') {
        console.warn('Could not join chat_members:', joinError.message);
      }
    } else {
      // Refetch members so the caller gets the updated list including the new user
      const { data: refreshedMembers } = await supabase
        .from('chat_members')
        .select('user_id, profiles(id, display_name, avatar_url, status_message, last_seen)')
        .eq('chat_id', defaultChatId);
      if (refreshedMembers) {
        members = refreshedMembers;
      }
    }
  }

  const parsedMembers = (members || []).map(m => m.profiles).filter(Boolean);
  const partner = parsedMembers.find(p => p.id !== currentUserId) || null;

  return {
    chat,
    members: parsedMembers,
    partner
  };
}
