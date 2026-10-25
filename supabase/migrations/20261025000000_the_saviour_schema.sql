-- ==============================================================================
-- THE SAVIOUR — COMPLETE DATABASE SCHEMA & ROW LEVEL SECURITY (RLS) POLICIES
-- Target: Supabase Free Tier (PostgreSQL)
-- Security: Strictly restricted to 2 authorized accounts. Zero public access.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. AUTHORIZED USERS WHITELIST TABLE
-- Only the two users whose emails or UUIDs are recorded here can access the system.
CREATE TABLE IF NOT EXISTS public.authorized_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    user_id UUID UNIQUE, -- linked automatically on first login
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.authorized_users ENABLE ROW LEVEL SECURITY;

-- Helper security function: checks if the caller is authorized
CREATE OR REPLACE FUNCTION public.is_authorized()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.authorized_users
    WHERE user_id = auth.uid() 
       OR email = LOWER(auth.jwt() ->> 'email')
  );
$$;

-- RLS for authorized_users: Only authorized users can see the whitelist
DROP POLICY IF EXISTS "Authorized users can view whitelist" ON public.authorized_users;
CREATE POLICY "Authorized users can view whitelist"
    ON public.authorized_users
    FOR SELECT
    TO authenticated
    USING (public.is_authorized());

-- 3. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    status_message TEXT DEFAULT 'Together in our sanctuary',
    last_seen TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized users can view profiles" ON public.profiles;
CREATE POLICY "Authorized users can view profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (public.is_authorized());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id AND public.is_authorized())
    WITH CHECK (auth.uid() = id AND public.is_authorized());

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id AND public.is_authorized());

-- 4. USER SETTINGS TABLE (Created here so handle_new_user can populate defaults)
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'dark',
    streaks_enabled BOOLEAN DEFAULT true,
    notifications_enabled BOOLEAN DEFAULT true,
    quiet_hours_start TEXT DEFAULT '23:00',
    quiet_hours_end TEXT DEFAULT '07:00',
    reveal_answers_immediately BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their settings" ON public.user_settings;
CREATE POLICY "Users can view their settings"
    ON public.user_settings FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id AND public.is_authorized());

DROP POLICY IF EXISTS "Users can insert their settings" ON public.user_settings;
CREATE POLICY "Users can insert their settings"
    ON public.user_settings FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id AND public.is_authorized());

DROP POLICY IF EXISTS "Users can update their settings" ON public.user_settings;
CREATE POLICY "Users can update their settings"
    ON public.user_settings FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id AND public.is_authorized())
    WITH CHECK (auth.uid() = user_id AND public.is_authorized());

-- Function to handle new user registration and link to authorized_users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    is_whitelisted BOOLEAN;
    user_email TEXT;
BEGIN
    user_email := LOWER(NEW.email);
    
    -- Check if user is in authorized_users list
    SELECT EXISTS (
        SELECT 1 FROM public.authorized_users WHERE LOWER(email) = user_email
    ) INTO is_whitelisted;

    IF NOT is_whitelisted THEN
        -- Reject unauthorized account creation
        RAISE EXCEPTION 'Access Denied: This private sanctuary is strictly restricted to authorized accounts.';
    END IF;

    -- Link user_id in authorized_users table
    UPDATE public.authorized_users
    SET user_id = NEW.id
    WHERE LOWER(email) = user_email;

    -- Create profile automatically
    INSERT INTO public.profiles (id, display_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(user_email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    )
    ON CONFLICT (id) DO NOTHING;

    -- Create default user settings
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Trigger on auth.users for automatic profile initialization and whitelist validation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. CHATS TABLE
CREATE TABLE IF NOT EXISTS public.chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'The Saviour Sanctuary',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized users can view chats" ON public.chats;
CREATE POLICY "Authorized users can view chats"
    ON public.chats FOR SELECT
    TO authenticated
    USING (public.is_authorized());

DROP POLICY IF EXISTS "Authorized users can create chats" ON public.chats;
CREATE POLICY "Authorized users can create chats"
    ON public.chats FOR INSERT
    TO authenticated
    WITH CHECK (public.is_authorized());

-- 6. CHAT MEMBERS TABLE (Strictly capped at max 2 members)
CREATE TABLE IF NOT EXISTS public.chat_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(chat_id, user_id)
);

ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized members can view chat_members" ON public.chat_members;
CREATE POLICY "Authorized members can view chat_members"
    ON public.chat_members FOR SELECT
    TO authenticated
    USING (public.is_authorized());

DROP POLICY IF EXISTS "Authorized members can join chat" ON public.chat_members;
CREATE POLICY "Authorized members can join chat"
    ON public.chat_members FOR INSERT
    TO authenticated
    WITH CHECK (public.is_authorized());

-- Trigger to guarantee that no chat ever has more than 2 members
CREATE OR REPLACE FUNCTION public.enforce_two_member_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM public.chat_members WHERE chat_id = NEW.chat_id) >= 2 THEN
        RAISE EXCEPTION 'Security Policy Violation: The Saviour private sanctuary is restricted to exactly two members.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_two_member_cap ON public.chat_members;
CREATE TRIGGER trg_enforce_two_member_cap
    BEFORE INSERT ON public.chat_members
    FOR EACH ROW EXECUTE FUNCTION public.enforce_two_member_cap();

-- 7. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT,
    type TEXT NOT NULL DEFAULT 'text', -- 'text', 'image', 'gift', 'sticker'
    metadata JSONB DEFAULT '{}'::jsonb, -- photo path, reply_to {id, sender_name, snippet}, gift info
    is_deleted BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'sent', -- 'sending', 'sent', 'delivered', 'read'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_messages_chat_id_created_at ON public.messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);

DROP POLICY IF EXISTS "Authorized users can view messages" ON public.messages;
CREATE POLICY "Authorized users can view messages"
    ON public.messages FOR SELECT
    TO authenticated
    USING (public.is_authorized());

DROP POLICY IF EXISTS "Authorized users can insert messages as themselves" ON public.messages;
CREATE POLICY "Authorized users can insert messages as themselves"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = sender_id AND public.is_authorized());

DROP POLICY IF EXISTS "Senders can edit or soft-delete their own messages" ON public.messages;
CREATE POLICY "Senders can edit or soft-delete their own messages"
    ON public.messages FOR UPDATE
    TO authenticated
    USING (auth.uid() = sender_id AND public.is_authorized())
    WITH CHECK (auth.uid() = sender_id AND public.is_authorized());

DROP POLICY IF EXISTS "Senders can delete their own messages" ON public.messages;
CREATE POLICY "Senders can delete their own messages"
    ON public.messages FOR DELETE
    TO authenticated
    USING (auth.uid() = sender_id AND public.is_authorized());

-- 8. MESSAGE REACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_reactions_message ON public.message_reactions(message_id);

DROP POLICY IF EXISTS "Authorized users can view reactions" ON public.message_reactions;
CREATE POLICY "Authorized users can view reactions"
    ON public.message_reactions FOR SELECT
    TO authenticated
    USING (public.is_authorized());

DROP POLICY IF EXISTS "Users can add their own reaction" ON public.message_reactions;
CREATE POLICY "Users can add their own reaction"
    ON public.message_reactions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id AND public.is_authorized());

DROP POLICY IF EXISTS "Users can remove their own reaction" ON public.message_reactions;
CREATE POLICY "Users can remove their own reaction"
    ON public.message_reactions FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id AND public.is_authorized());

-- 9. MESSAGE READ STATUS TABLE
CREATE TABLE IF NOT EXISTS public.message_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_read_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    last_read_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(chat_id, user_id)
);

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized users can view read states" ON public.message_reads;
CREATE POLICY "Authorized users can view read states"
    ON public.message_reads FOR SELECT
    TO authenticated
    USING (public.is_authorized());

DROP POLICY IF EXISTS "Users can update their own read state" ON public.message_reads;
CREATE POLICY "Users can update their own read state"
    ON public.message_reads FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id AND public.is_authorized());

DROP POLICY IF EXISTS "Users can modify their own read state" ON public.message_reads;
CREATE POLICY "Users can modify their own read state"
    ON public.message_reads FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id AND public.is_authorized())
    WITH CHECK (auth.uid() = user_id AND public.is_authorized());

-- 10. MOODS TABLE
CREATE TABLE IF NOT EXISTS public.moods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    mood TEXT NOT NULL, -- 'Happy', 'Loving', 'Sleepy', 'Sad', 'Angry', 'Overthinking', 'Chill', 'Excited', 'Dramatic', 'Tired'
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.moods ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_moods_user_created ON public.moods(user_id, created_at DESC);

DROP POLICY IF EXISTS "Authorized users can view moods" ON public.moods;
CREATE POLICY "Authorized users can view moods"
    ON public.moods FOR SELECT
    TO authenticated
    USING (public.is_authorized());

DROP POLICY IF EXISTS "Users can post their own mood" ON public.moods;
CREATE POLICY "Users can post their own mood"
    ON public.moods FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id AND public.is_authorized());

DROP POLICY IF EXISTS "Users can delete their own mood" ON public.moods;
CREATE POLICY "Users can delete their own mood"
    ON public.moods FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id AND public.is_authorized());

-- 11. DAILY QUESTIONS & ANSWERS TABLE
CREATE TABLE IF NOT EXISTS public.daily_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    category TEXT DEFAULT 'connection',
    order_index INTEGER UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.daily_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized users can view daily questions" ON public.daily_questions;
CREATE POLICY "Authorized users can view daily questions"
    ON public.daily_questions FOR SELECT
    TO authenticated
    USING (public.is_authorized());

CREATE TABLE IF NOT EXISTS public.daily_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES public.daily_questions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    answer TEXT NOT NULL,
    answered_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(question_id, user_id)
);

ALTER TABLE public.daily_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized users can view answers" ON public.daily_answers;
CREATE POLICY "Authorized users can view answers"
    ON public.daily_answers FOR SELECT
    TO authenticated
    USING (public.is_authorized());

DROP POLICY IF EXISTS "Users can submit their answer" ON public.daily_answers;
CREATE POLICY "Users can submit their answer"
    ON public.daily_answers FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id AND public.is_authorized());

DROP POLICY IF EXISTS "Users can update their answer" ON public.daily_answers;
CREATE POLICY "Users can update their answer"
    ON public.daily_answers FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id AND public.is_authorized())
    WITH CHECK (auth.uid() = user_id AND public.is_authorized());

-- 12. MINI GAMES TABLE
CREATE TABLE IF NOT EXISTS public.games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_type TEXT NOT NULL, -- 'who_knows_whom', 'this_or_that', 'guess_my_answer', 'emoji_riddle', 'truth_or_dare'
    title TEXT NOT NULL,
    status TEXT DEFAULT 'in_progress', -- 'in_progress', 'completed'
    state JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized users can view games" ON public.games;
CREATE POLICY "Authorized users can view games"
    ON public.games FOR SELECT
    TO authenticated
    USING (public.is_authorized());

DROP POLICY IF EXISTS "Authorized users can create games" ON public.games;
CREATE POLICY "Authorized users can create games"
    ON public.games FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by AND public.is_authorized());

DROP POLICY IF EXISTS "Authorized users can update games" ON public.games;
CREATE POLICY "Authorized users can update games"
    ON public.games FOR UPDATE
    TO authenticated
    USING (public.is_authorized())
    WITH CHECK (public.is_authorized());

CREATE TABLE IF NOT EXISTS public.game_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    round INTEGER DEFAULT 1,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.game_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized users can view game answers" ON public.game_answers;
CREATE POLICY "Authorized users can view game answers"
    ON public.game_answers FOR SELECT
    TO authenticated
    USING (public.is_authorized());

DROP POLICY IF EXISTS "Authorized users can submit game answers" ON public.game_answers;
CREATE POLICY "Authorized users can submit game answers"
    ON public.game_answers FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id AND public.is_authorized());

-- 13. MYSTERY CARDS TABLE
CREATE TABLE IF NOT EXISTS public.mystery_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_type TEXT NOT NULL, -- 'joke', 'compliment', 'prompt', 'challenge', 'fact', 'quiz'
    content TEXT NOT NULL,
    subtext TEXT,
    order_index INTEGER UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.mystery_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized users can view mystery cards" ON public.mystery_cards;
CREATE POLICY "Authorized users can view mystery cards"
    ON public.mystery_cards FOR SELECT
    TO authenticated
    USING (public.is_authorized());

CREATE TABLE IF NOT EXISTS public.user_card_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID REFERENCES public.mystery_cards(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_completed BOOLEAN DEFAULT false,
    revealed_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    UNIQUE(card_id, user_id)
);

ALTER TABLE public.user_card_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized users can view card interactions" ON public.user_card_interactions;
CREATE POLICY "Authorized users can view card interactions"
    ON public.user_card_interactions FOR SELECT
    TO authenticated
    USING (public.is_authorized());

DROP POLICY IF EXISTS "Users can manage card interactions" ON public.user_card_interactions;
CREATE POLICY "Users can manage card interactions"
    ON public.user_card_interactions FOR ALL
    TO authenticated
    USING (auth.uid() = user_id AND public.is_authorized())
    WITH CHECK (auth.uid() = user_id AND public.is_authorized());

-- 14. SHARED MEMORIES TABLE
CREATE TABLE IF NOT EXISTS public.memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- 'photo', 'message', 'qa', 'game', 'gift', 'note'
    title TEXT NOT NULL,
    content TEXT,
    media_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_memories_created ON public.memories(created_at DESC);

DROP POLICY IF EXISTS "Authorized users can view memories" ON public.memories;
CREATE POLICY "Authorized users can view memories"
    ON public.memories FOR SELECT
    TO authenticated
    USING (public.is_authorized());

DROP POLICY IF EXISTS "Users can add memories" ON public.memories;
CREATE POLICY "Users can add memories"
    ON public.memories FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id AND public.is_authorized());

DROP POLICY IF EXISTS "Users can delete their own memories" ON public.memories;
CREATE POLICY "Users can delete their own memories"
    ON public.memories FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id AND public.is_authorized());

-- 15. SPECIAL EVENTS / COUNTDOWNS TABLE
CREATE TABLE IF NOT EXISTS public.special_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    event_date DATE NOT NULL,
    category TEXT DEFAULT 'anniversary', -- 'anniversary', 'birthday', 'trip', 'special'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.special_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized users can view events" ON public.special_events;
CREATE POLICY "Authorized users can view events"
    ON public.special_events FOR SELECT
    TO authenticated
    USING (public.is_authorized());

DROP POLICY IF EXISTS "Authorized users can add events" ON public.special_events;
CREATE POLICY "Authorized users can add events"
    ON public.special_events FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by AND public.is_authorized());

DROP POLICY IF EXISTS "Users can delete their events" ON public.special_events;
CREATE POLICY "Users can delete their events"
    ON public.special_events FOR DELETE
    TO authenticated
    USING (auth.uid() = created_by AND public.is_authorized());

-- ==============================================================================
-- 16. SUPABASE STORAGE BUCKET & SECURITY POLICIES
-- ==============================================================================
-- Insert the private bucket 'chat-photos' into storage.buckets if not existing
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat-photos',
    'chat-photos',
    false, -- STRICTLY PRIVATE BUCKET
    5242880, -- 5 MB maximum file size limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET 
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS: Authorized users can read/download photos
DROP POLICY IF EXISTS "Authorized users can read chat photos" ON storage.objects;
CREATE POLICY "Authorized users can read chat photos"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'chat-photos' AND public.is_authorized());

-- Storage RLS: Authorized users can upload photos
DROP POLICY IF EXISTS "Authorized users can upload chat photos" ON storage.objects;
CREATE POLICY "Authorized users can upload chat photos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'chat-photos' 
        AND public.is_authorized()
    );

-- Storage RLS: Users can delete objects they own
DROP POLICY IF EXISTS "Users can delete their own chat photos" ON storage.objects;
CREATE POLICY "Users can delete their own chat photos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'chat-photos'
        AND public.is_authorized()
        AND (auth.uid() = owner OR (storage.foldername(name))[2] = auth.uid()::text)
    );

-- ==============================================================================
-- 17. SUPABASE REALTIME CONFIGURATION
-- ==============================================================================
-- Set REPLICA IDENTITY to FULL for tables with Row Level Security (RLS) enabled
-- This ensures all column values are available during real-time replication and policy checks
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.message_reads REPLICA IDENTITY FULL;
ALTER TABLE public.moods REPLICA IDENTITY FULL;
ALTER TABLE public.games REPLICA IDENTITY FULL;
ALTER TABLE public.game_answers REPLICA IDENTITY FULL;

-- Enable Realtime publication for tables requiring live communication
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.moods;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.game_answers;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;
