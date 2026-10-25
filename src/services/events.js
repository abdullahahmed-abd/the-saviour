import { supabase } from './supabase';

/**
 * Fetch all countdown events
 */
export async function fetchSpecialEvents() {
  const { data, error } = await supabase
    .from('special_events')
    .select(`
      id,
      created_by,
      title,
      event_date,
      category,
      notes,
      created_at,
      profiles:created_by(display_name)
    `)
    .order('event_date', { ascending: true });

  if (error) {
    console.warn('Could not fetch special events:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Add a new countdown event
 */
export async function addSpecialEvent({ userId, title, eventDate, category = 'anniversary', notes = '' }) {
  if (!title || !eventDate) throw new Error('Title and Date are required');

  const { data, error } = await supabase
    .from('special_events')
    .insert({
      created_by: userId,
      title: title.trim(),
      event_date: eventDate,
      category,
      notes: notes.trim()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a countdown event
 */
export async function deleteSpecialEvent(eventId) {
  const { error } = await supabase
    .from('special_events')
    .delete()
    .eq('id', eventId);

  if (error) throw error;
}
