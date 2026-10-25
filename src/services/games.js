import { supabase } from './supabase';

export const MINI_GAMES = [
  {
    id: 'who_knows_whom',
    title: 'Who Knows Whom Better?',
    icon: 'Brain',
    color: '#8b5cf6',
    description: 'Answer questions about each other to test how deeply you know each other!',
    questions: [
      { q: 'What is my favorite way to spend a quiet Sunday afternoon?', options: ['Bingeing movies/shows', 'Reading with cozy music', 'Cooking or baking', 'Sleeping in & chilling'] },
      { q: 'What is my go-to order when getting drinks or coffee?', options: ['Iced Caramel Latte', 'Masala Chai', 'Matcha or Green Tea', 'Fresh Juice or Smoothie'] },
      { q: 'What is my biggest pet peeve?', options: ['Slow walkers or bad drivers', 'People being late', 'Loud chewers', 'Unread notifications'] },
      { q: 'If I won a free flight right now, what destination would I pick?', options: ['Tokyo / Kyoto', 'Swiss Alps', 'Tropical Beach in Bali', 'Paris or Rome'] },
      { q: 'What kind of movies do I secretly love most?', options: ['Mind-bending Sci-Fi', 'Cheesy Rom-Coms', 'Psychological Thrillers', 'Animated Studio Ghibli'] }
    ]
  },
  {
    id: 'this_or_that',
    title: 'This or That',
    icon: 'Shuffle',
    color: '#ec4899',
    description: 'Choose rapid-fire preferences and see how many of your answers match!',
    questions: [
      { a: 'Late night talks 🌙', b: 'Early morning walks ☀️' },
      { a: 'Cozy night in 🛋️', b: 'Adventurous night out 🌃' },
      { a: 'Sweet desserts 🍰', b: 'Savory & spicy snacks 🍕' },
      { a: 'Beach vacation 🏖️', b: 'Misty mountain cabin 🏔️' },
      { a: 'Long voice calls 📞', b: 'Endless texting 💬' },
      { a: 'Cook at home together 🍳', b: 'Order takeout feast 🥡' },
      { a: 'Watch a movie 🎬', b: 'Listen to music & talk 🎶' },
      { a: 'Road trip drive 🚗', b: 'Fast train / flight ✈️' }
    ]
  },
  {
    id: 'guess_my_answer',
    title: 'Guess My Answer',
    icon: 'HelpCircle',
    color: '#38bdf8',
    description: 'One person writes a secret answer, and the partner tries to guess it!',
    prompts: [
      'What number between 1 and 100 am I thinking of right now?',
      'If I had to describe you with one single animal, what would it be?',
      'What is one food item I am currently craving?',
      'Guess which song I have been humming or replaying in my head today.',
      'What is the first word that comes to my mind when I think of you?'
    ]
  },
  {
    id: 'emoji_riddle',
    title: 'Emoji Guessing',
    icon: 'Smile',
    color: '#f59e0b',
    description: 'Decode the movie, song, or hidden phrase from emoji clues!',
    riddles: [
      { emojis: '🦁 👑 🌅', answer: 'The Lion King', hint: 'Disney classic' },
      { emojis: '🧊 🚢 💔 🌊', answer: 'Titanic', hint: 'Jack & Rose' },
      { emojis: '🕷️ 🧑 🕸️ 🏙️', answer: 'Spider-Man', hint: 'Marvel hero' },
      { emojis: '💍 🌋 🧝 🧙‍♂️', answer: 'Lord of the Rings', hint: 'One ring to rule them all' },
      { emojis: '🍫 🏭 🎩 🎟️', answer: 'Willy Wonka / Charlie and the Chocolate Factory', hint: 'Golden ticket' },
      { emojis: '☕ 🍩 ☔ 🌧️', answer: 'Rainy Cafe Date', hint: 'A cozy scene' }
    ]
  },
  {
    id: 'truth_or_dare',
    title: 'Truth or Silly Dare',
    icon: 'Sparkles',
    color: '#10b981',
    description: 'Playful truths and lighthearted dares made for two.',
    truths: [
      'What was the exact moment you realized you had special feelings for me?',
      'What is an embarrassing fashion trend or haircut you used to rock?',
      'If you could read my mind for 5 minutes, what would you want to find out?',
      'What is something silly you do when you are completely alone?',
      'What is your favorite memory of us laughing until our stomachs hurt?'
    ],
    dares: [
      'Send a 10-second voice note singing the chorus of the cheesiest song you know.',
      'Take an unfiltered, ridiculously silly selfie right now and send it to the chat.',
      'Speak in a fake royal British or Victorian accent for the next 5 messages.',
      'Send me a virtual gift with a poem explaining why that item represents our bond.',
      'Do 10 jumping jacks or stretches and report back with proof!'
    ]
  }
];

/**
 * Fetch or start a game session
 */
export async function getActiveGame(gameType) {
  const { data, error } = await supabase
    .from('games')
    .select(`
      id,
      game_type,
      title,
      status,
      state,
      created_by,
      created_at,
      game_answers(id, user_id, round, response, created_at, profiles:user_id(display_name))
    `)
    .eq('game_type', gameType)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('Active game fetch error:', error.message);
    return null;
  }
  return data;
}

/**
 * Create a new game session
 */
export async function createGameSession(gameType, title, userId, initialState = {}) {
  const { data, error } = await supabase
    .from('games')
    .insert({
      game_type: gameType,
      title,
      status: 'in_progress',
      state: initialState,
      created_by: userId
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Submit player response to a game
 */
export async function submitGameAnswer(gameId, userId, round, response) {
  const { data, error } = await supabase
    .from('game_answers')
    .insert({
      game_id: gameId,
      user_id: userId,
      round,
      response
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * End or restart a game
 */
export async function updateGameStatus(gameId, status = 'completed', finalState = {}) {
  const { data, error } = await supabase
    .from('games')
    .update({
      status,
      state: finalState,
      updated_at: new Date().toISOString()
    })
    .eq('id', gameId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
