import { supabase } from './supabase';

/**
 * Fetch and calculate real statistics from database records
 */
export async function getSanctuaryStatistics(timeframe = 'all') {
  // Compute date filter boundary
  let cutoffDate = null;
  const now = new Date();
  if (timeframe === 'week') {
    cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  } else if (timeframe === 'month') {
    cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  // 1. Fetch messages
  let messagesQuery = supabase
    .from('messages')
    .select('id, sender_id, type, created_at, is_deleted');

  if (cutoffDate) {
    messagesQuery = messagesQuery.gte('created_at', cutoffDate);
  }

  const { data: messages, error: msgErr } = await messagesQuery;
  if (msgErr) throw msgErr;

  const validMessages = (messages || []).filter(m => !m.is_deleted);
  const totalMessages = validMessages.length;

  // Count by user
  const userMessageCounts = {};
  const photosCount = validMessages.filter(m => m.type === 'image').length;

  // Hourly distribution (0-23)
  const hourlyCounts = new Array(24).fill(0);
  // Day of week distribution (0 = Sun, 6 = Sat)
  const dayOfWeekCounts = new Array(7).fill(0);
  const activeDaysSet = new Set();

  validMessages.forEach(m => {
    userMessageCounts[m.sender_id] = (userMessageCounts[m.sender_id] || 0) + 1;
    const msgDate = new Date(m.created_at);
    hourlyCounts[msgDate.getHours()]++;
    dayOfWeekCounts[msgDate.getDay()]++;
    activeDaysSet.add(msgDate.toISOString().split('T')[0]);
  });

  // Calculate busiest hour
  let maxHourVal = -1;
  let busiestHour = 0;
  hourlyCounts.forEach((val, hour) => {
    if (val > maxHourVal) {
      maxHourVal = val;
      busiestHour = hour;
    }
  });

  // Calculate busiest day of week
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let maxDayVal = -1;
  let busiestDayIndex = 0;
  dayOfWeekCounts.forEach((val, dayIdx) => {
    if (val > maxDayVal) {
      maxDayVal = val;
      busiestDayIndex = dayIdx;
    }
  });

  // 2. Calculate Streaks from all active dates
  const sortedDates = Array.from(activeDaysSet).sort();
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  if (sortedDates.length > 0) {
    let prevDate = null;
    sortedDates.forEach(dateStr => {
      const curDate = new Date(dateStr);
      if (!prevDate) {
        tempStreak = 1;
      } else {
        const diffDays = Math.round((curDate - prevDate) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
      }
      if (tempStreak > longestStreak) longestStreak = tempStreak;
      prevDate = curDate;
    });

    // Check if current streak is active (today or yesterday included)
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const lastActiveStr = sortedDates[sortedDates.length - 1];

    if (lastActiveStr === todayStr || lastActiveStr === yesterdayStr) {
      currentStreak = tempStreak;
    } else {
      currentStreak = 0;
    }
  }

  // 3. Reactions count
  const { count: reactionsCount } = await supabase
    .from('message_reactions')
    .select('*', { count: 'exact', head: true });

  // 4. Games count
  const { count: gamesCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });

  // 5. Daily questions count
  const { count: questionsAnsweredCount } = await supabase
    .from('daily_answers')
    .select('*', { count: 'exact', head: true });

  // 6. Memories count
  const { count: memoriesCount } = await supabase
    .from('memories')
    .select('*', { count: 'exact', head: true });

  // Format hourly chart data
  const hourlyChartData = hourlyCounts.map((count, hour) => ({
    label: `${hour % 12 === 0 ? 12 : hour % 12}${hour >= 12 ? 'pm' : 'am'}`,
    hour,
    count
  }));

  return {
    totalMessages,
    userMessageCounts,
    photosCount,
    reactionsCount: reactionsCount || 0,
    activeDays: activeDaysSet.size,
    busiestHour: `${busiestHour % 12 === 0 ? 12 : busiestHour % 12}:00 ${busiestHour >= 12 ? 'PM' : 'AM'}`,
    busiestDay: dayNames[busiestDayIndex],
    currentStreak,
    longestStreak,
    gamesCount: gamesCount || 0,
    questionsAnsweredCount: questionsAnsweredCount || 0,
    memoriesCount: memoriesCount || 0,
    hourlyChartData,
    dayOfWeekData: dayOfWeekCounts.map((count, idx) => ({ day: dayNames[idx].slice(0, 3), count }))
  };
}

/**
 * Calculate user achievements based on actual DB stats
 */
export function calculateAchievements(stats) {
  const achievements = [
    {
      id: 'first_message',
      title: 'First Word',
      description: 'Sent the first message in our sanctuary.',
      icon: 'MessageCircle',
      unlocked: stats.totalMessages >= 1,
      progress: Math.min(stats.totalMessages, 1),
      max: 1
    },
    {
      id: 'century_club',
      title: 'Century Club',
      description: 'Shared 100 heartfelt messages together.',
      icon: 'Award',
      unlocked: stats.totalMessages >= 100,
      progress: Math.min(stats.totalMessages, 100),
      max: 100
    },
    {
      id: 'message_titan',
      title: 'Endless Banter',
      description: 'Reached 500 messages in conversation.',
      icon: 'Flame',
      unlocked: stats.totalMessages >= 500,
      progress: Math.min(stats.totalMessages, 500),
      max: 500
    },
    {
      id: 'photo_keeper',
      title: 'Visual Album',
      description: 'Exchanged 10 or more private photos.',
      icon: 'Camera',
      unlocked: stats.photosCount >= 10,
      progress: Math.min(stats.photosCount, 10),
      max: 10
    },
    {
      id: 'quiz_master',
      title: 'Soul Synchronized',
      description: 'Answered 10 daily reflection questions.',
      icon: 'Brain',
      unlocked: stats.questionsAnsweredCount >= 10,
      progress: Math.min(stats.questionsAnsweredCount, 10),
      max: 10
    },
    {
      id: 'memory_guardian',
      title: 'Sanctuary Archive',
      description: 'Saved 5 cherished memories.',
      icon: 'Bookmark',
      unlocked: stats.memoriesCount >= 5,
      progress: Math.min(stats.memoriesCount, 5),
      max: 5
    },
    {
      id: 'seven_day_streak',
      title: '7-Day Sanctuary',
      description: 'Connected 7 consecutive days in a row.',
      icon: 'Sparkles',
      unlocked: stats.longestStreak >= 7,
      progress: Math.min(stats.longestStreak, 7),
      max: 7
    }
  ];

  return achievements;
}
