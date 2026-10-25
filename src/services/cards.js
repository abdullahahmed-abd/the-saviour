import { supabase } from './supabase';

const FALLBACK_CARDS = [
  { id: 'fc-1', card_type: 'compliment', content: 'You bring a rare calm and radiance to my world that nobody else could ever duplicate.', subtext: 'A little reminder of who you are.' },
  { id: 'fc-2', card_type: 'joke', content: 'Why do bees have sticky hair? Because they use honeycombs! 🍯🐝', subtext: 'Guaranteed dad joke of the day.' },
  { id: 'fc-3', card_type: 'challenge', content: 'Send an audio note or a 5-second voice note saying something sweet or ridiculous right now!', subtext: 'No excuses allowed!' },
  { id: 'fc-4', card_type: 'fact', content: 'Did you know? Sea otters hold hands while sleeping so they do not drift apart in the current. 🦦❤️', subtext: 'Sanctuary couple goals.' },
  { id: 'fc-5', card_type: 'prompt', content: 'Share a photo or screenshot of the last thing that made you smile today.', subtext: 'Drop it right into our chat.' }
];

/**
 * Get daily mystery card for today
 */
export async function getDailyMysteryCard(userId) {
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);

  const { data: cards, error } = await supabase
    .from('mystery_cards')
    .select('*')
    .order('order_index', { ascending: true });

  let card;
  if (error || !cards || cards.length === 0) {
    const idx = (dayOfYear - 1) % FALLBACK_CARDS.length;
    card = FALLBACK_CARDS[idx];
  } else {
    const idx = (dayOfYear - 1) % cards.length;
    card = cards[idx];
  }

  // Check interaction for user if card has DB UUID
  let interaction = null;
  if (card && !card.id.startsWith('fc-')) {
    const { data: userInt } = await supabase
      .from('user_card_interactions')
      .select('*')
      .eq('card_id', card.id)
      .eq('user_id', userId)
      .maybeSingle();

    interaction = userInt;
  }

  return {
    card,
    interaction
  };
}

/**
 * Mark mystery card completed
 */
export async function markCardCompleted(cardId, userId) {
  if (!cardId || cardId.startsWith('fc-')) return;

  const { data, error } = await supabase
    .from('user_card_interactions')
    .upsert({
      card_id: cardId,
      user_id: userId,
      is_completed: true,
      completed_at: new Date().toISOString()
    }, { onConflict: 'card_id, user_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}
