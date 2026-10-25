import { supabase } from './supabase';

const FALLBACK_QUESTIONS = [
  { id: 'fb-1', order_index: 1, question: 'What is one little thing that made you smile or feel at peace today?', category: 'gratitude' },
  { id: 'fb-2', order_index: 2, question: 'What is your absolute favorite memory of us together?', category: 'memory' },
  { id: 'fb-3', order_index: 3, question: 'If we could teleport anywhere for 24 hours right now, where would we go?', category: 'adventure' },
  { id: 'fb-4', order_index: 4, question: 'What is something new or exciting you would love for us to try together?', category: 'dreams' },
  { id: 'fb-5', order_index: 5, question: 'What is one thing you appreciate about how we communicate and understand each other?', category: 'gratitude' }
];

/**
 * Get question for today based on calendar day
 */
export async function getTodayQuestion() {
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);

  const { data, error } = await supabase
    .from('daily_questions')
    .select('*')
    .order('order_index', { ascending: true });

  if (error || !data || data.length === 0) {
    const fallbackIdx = dayOfYear % FALLBACK_QUESTIONS.length;
    return FALLBACK_QUESTIONS[fallbackIdx];
  }

  const selectedIndex = (dayOfYear - 1) % data.length;
  return data[selectedIndex] || data[0];
}

/**
 * Fetch answers for a question
 */
export async function getQuestionAnswers(questionId) {
  if (!questionId || questionId.startsWith('fb-')) return [];

  const { data, error } = await supabase
    .from('daily_answers')
    .select(`
      id,
      question_id,
      user_id,
      answer,
      answered_at,
      profiles:user_id(id, display_name, avatar_url)
    `)
    .eq('question_id', questionId);

  if (error) {
    console.warn('Failed to load answers:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Submit an answer to a daily question
 */
export async function submitDailyAnswer(questionId, userId, answer) {
  if (!answer || !answer.trim()) throw new Error('Answer cannot be empty');

  const { data, error } = await supabase
    .from('daily_answers')
    .upsert(
      {
        question_id: questionId,
        user_id: userId,
        answer: answer.trim(),
        answered_at: new Date().toISOString()
      },
      { onConflict: 'question_id, user_id' }
    )
    .select(`
      id,
      question_id,
      user_id,
      answer,
      answered_at,
      profiles:user_id(id, display_name, avatar_url)
    `)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch past answered questions
 */
export async function getPastQuestions() {
  const { data, error } = await supabase
    .from('daily_questions')
    .select(`
      id,
      question,
      category,
      order_index,
      daily_answers(
        id,
        user_id,
        answer,
        answered_at,
        profiles:user_id(display_name, avatar_url)
      )
    `)
    .order('order_index', { ascending: false })
    .limit(20);

  if (error) {
    console.warn('Could not fetch past questions:', error.message);
    return [];
  }

  // Filter to questions that have at least 1 answer
  return (data || []).filter(q => q.daily_answers && q.daily_answers.length > 0);
}
