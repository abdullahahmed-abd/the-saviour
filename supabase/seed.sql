-- ==============================================================================
-- THE SAVIOUR — SEED DATA
-- Default Sanctuary Chat, Curated Daily Questions, and Mystery Cards
-- ==============================================================================

-- 1. DEFAULT SANCTUARY CHAT
-- A single permanent private room for the two authorized users
INSERT INTO public.chats (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'The Saviour Sanctuary')
ON CONFLICT (id) DO NOTHING;

-- 2. CURATED DAILY QUESTIONS (30 thoughtful connection questions)
INSERT INTO public.daily_questions (order_index, question, category) VALUES
(1, 'What is one little thing that made you smile or feel at peace today?', 'gratitude'),
(2, 'What is your absolute favorite memory of us together?', 'memory'),
(3, 'If we could teleport anywhere in the world for 24 hours right now, where would we go?', 'adventure'),
(4, 'What is something new or exciting you would love for us to try together?', 'dreams'),
(5, 'What was going through your mind the very first time we met or spoke?', 'memory'),
(6, 'What song reminds you of our connection whenever you hear it?', 'favorites'),
(7, 'What is one thing you appreciate about how we communicate and understand each other?', 'gratitude'),
(8, 'What is your idea of a perfect, cozy evening together?', 'comfort'),
(9, 'What is a small, quiet quirk of mine that you secretly find endearing?', 'connection'),
(10, 'When do you feel most loved, safe, and protected?', 'vulnerability'),
(11, 'If we were characters in a movie or book, what genre would our story be?', 'playful'),
(12, 'What is a personal dream or ambition you are currently working toward?', 'growth'),
(13, 'What is your ultimate comfort food after an exhausting day?', 'favorites'),
(14, 'What is one lesson from the past year that you are most thankful for?', 'reflection'),
(15, 'What is the funniest inside joke or moment that still makes you laugh out loud?', 'humor'),
(16, 'If you could relive any single day from our past together, which day would it be?', 'memory'),
(17, 'What is something you needed to hear today that would lift your spirits?', 'comfort'),
(18, 'What is a skill or hobby you think both of us would have a blast learning together?', 'adventure'),
(19, 'What was your favorite childhood cartoon, book, or pastime?', 'nostalgia'),
(20, 'What is the sweetest or most thoughtful thing someone has ever done for you?', 'gratitude'),
(21, 'If we had a whole weekend completely free from work and screens, what would we do?', 'adventure'),
(22, 'What is one quality you admire most about how I handle difficult times?', 'connection'),
(23, 'What is your favorite season or weather, and what memories does it bring back?', 'favorites'),
(24, 'What is a guilty pleasure song, show, or snack you cannot resist?', 'humor'),
(25, 'What does your ideal peaceful morning look like from start to finish?', 'comfort'),
(26, 'What is one goal or trip we should achieve together before the year ends?', 'dreams'),
(27, 'If you could give your younger self one piece of gentle advice, what would it be?', 'reflection'),
(28, 'What is something that always instantly calms you down when you feel overwhelmed?', 'comfort'),
(29, 'What is a secret talent or weird party trick you wish you had?', 'playful'),
(30, 'In three words, how would you describe the sanctuary we have created together?', 'connection')
ON CONFLICT (order_index) DO NOTHING;

-- 3. CURATED MYSTERY CARDS (Jokes, compliments, prompts, challenges, fun facts)
INSERT INTO public.mystery_cards (order_index, card_type, content, subtext) VALUES
(1, 'compliment', 'You bring a rare calm and radiance to my world that nobody else could ever duplicate.', 'Tap Save to Memories to keep this warmth forever.'),
(2, 'joke', 'Why do bees have sticky hair? Because they use honeycombs! 🍯🐝', 'Guaranteed dad joke of the day.'),
(3, 'challenge', 'Send an audio message or a 5-second voice note saying something sweet or ridiculous right now!', 'No excuses allowed!'),
(4, 'prompt', 'Share a screenshot or photo of the last thing that made you laugh today.', 'Drop it right into our chat.'),
(5, 'fact', 'Did you know? Sea otters hold hands while sleeping so they do not drift apart in the current. 🦦❤️', 'Nature’s ultimate relationship goal.'),
(6, 'compliment', 'Your resilience, intelligence, and kind heart are things I admire more than words can express.', 'A reminder of who you are.'),
(7, 'challenge', 'Drink a large glass of water right now and take 3 deep, relaxing breaths. You’ve been working hard.', 'Self-care check-in.'),
(8, 'joke', 'What did one wall say to the other wall? I’ll meet you at the corner! 🧱', 'Classic architectural humor.'),
(9, 'quiz', 'Quick quiz: What is my all-time favorite comfort beverage or snack? Text me your guess!', 'Winner gets eternal bragging rights.'),
(10, 'fact', 'A group of flamingos is officially called a "flamboyance". 🦩✨', 'Bringing elegance into your day.'),
(11, 'prompt', 'Tell me one small thing that is stressing you out right now so I can share the weight with you.', 'Sanctuary rule: never carry heavy thoughts alone.'),
(12, 'compliment', 'Whenever I talk to you, everything feels a little lighter and much more possible.', 'Thank you for being you.')
ON CONFLICT (order_index) DO NOTHING;

-- ==============================================================================
-- INSTRUCTIONS TO CONFIGURE AUTHORIZED USERS:
-- Run this in your Supabase SQL Editor, replacing with the 2 actual user emails:
--
-- INSERT INTO public.authorized_users (email, notes) VALUES
--   ('user1@example.com', 'Person One'),
--   ('user2@example.com', 'Person Two');
-- ==============================================================================
