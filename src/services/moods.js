import { supabase } from './supabase';

export const MOOD_OPTIONS = [
  { id: 'Loving', label: 'Loving', emoji: '🥰', color: '#ec4899', desc: 'Heart full of warmth' },
  { id: 'Happy', label: 'Happy', emoji: '😊', color: '#10b981', desc: 'Bright and smiling' },
  { id: 'Chill', label: 'Chill', emoji: '😎', color: '#38bdf8', desc: 'Relaxed and peaceful' },
  { id: 'Excited', label: 'Excited', emoji: '🥳', color: '#f59e0b', desc: 'Brimming with energy' },
  { id: 'Dramatic', label: 'Dramatic', emoji: '🎭', color: '#a855f7', desc: 'Living life cinematically' },
  { id: 'Overthinking', label: 'Overthinking', emoji: '🤯', color: '#8b5cf6', desc: 'Mind is in 100 tabs' },
  { id: 'Sleepy', label: 'Sleepy', emoji: '🥱', color: '#6366f1', desc: 'Ready for soft blankets' },
  { id: 'Tired', label: 'Tired', emoji: '😴', color: '#64748b', desc: 'Low battery mode' },
  { id: 'Sad', label: 'Sad', emoji: '🥺', color: '#0284c7', desc: 'In need of extra hugs' },
  { id: 'Angry', label: 'Angry', emoji: '😤', color: '#ef4444', desc: 'Needs space or venting' }
];

/**
 * Record a new mood
 */
export async function setMood(userId, mood, note = '') {
  const { data, error } = await supabase
    .from('moods')
    .insert({
      user_id: userId,
      mood,
      note
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get latest mood for both users
 */
export async function getLatestMoods() {
  const { data, error } = await supabase
    .from('moods')
    .select('id, user_id, mood, note, created_at, profiles:user_id(display_name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.warn('Failed to fetch moods:', error.message);
    return {};
  }

  // Get most recent mood per user
  const latestByUser = {};
  (data || []).forEach(m => {
    if (!latestByUser[m.user_id]) {
      latestByUser[m.user_id] = m;
    }
  });

  return latestByUser;
}

/**
 * Fetch mood history
 */
export async function getMoodHistory(limit = 30) {
  const { data, error } = await supabase
    .from('moods')
    .select('id, user_id, mood, note, created_at, profiles:user_id(display_name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Delete a user's own mood
 */
export async function deleteMood(moodId) {
  const { error } = await supabase
    .from('moods')
    .delete()
    .eq('id', moodId);

  if (error) throw error;
}
