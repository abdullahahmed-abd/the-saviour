import { supabase } from './supabase';

/**
 * Save an item to Shared Memories
 */
export async function saveToMemories({ userId, category, title, content = '', mediaUrl = '', metadata = {} }) {
  const { data, error } = await supabase
    .from('memories')
    .insert({
      user_id: userId,
      category, // 'photo', 'message', 'qa', 'game', 'gift', 'note'
      title,
      content,
      media_url: mediaUrl,
      metadata
    })
    .select(`
      id,
      user_id,
      category,
      title,
      content,
      media_url,
      metadata,
      created_at,
      profiles:user_id(display_name, avatar_url)
    `)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch all memories with optional category filter and search
 */
export async function fetchMemories({ category = 'all', searchQuery = '' } = {}) {
  let query = supabase
    .from('memories')
    .select(`
      id,
      user_id,
      category,
      title,
      content,
      media_url,
      metadata,
      created_at,
      profiles:user_id(display_name, avatar_url)
    `)
    .order('created_at', { ascending: false });

  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  if (searchQuery && searchQuery.trim()) {
    const term = `%${searchQuery.trim()}%`;
    query = query.or(`title.ilike.${term},content.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Delete a memory entry
 */
export async function deleteMemory(memoryId) {
  const { error } = await supabase
    .from('memories')
    .delete()
    .eq('id', memoryId);

  if (error) throw error;
}
