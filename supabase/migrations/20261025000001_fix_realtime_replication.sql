-- ==============================================================================
-- THE SAVIOUR — FIX REALTIME REPLICATION & REPLICA IDENTITY
-- Run this in your Supabase SQL Editor to enable full realtime message broadcasting
-- ==============================================================================

-- 1. Ensure REPLICA IDENTITY is set to FULL for all realtime tables
-- When Row Level Security (RLS) is enabled, Postgres requires REPLICA IDENTITY FULL
-- so the replication stream includes all columns for policy evaluation and client updates
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.message_reads REPLICA IDENTITY FULL;
ALTER TABLE public.moods REPLICA IDENTITY FULL;
ALTER TABLE public.games REPLICA IDENTITY FULL;
ALTER TABLE public.game_answers REPLICA IDENTITY FULL;

-- 2. Ensure all tables are added to the supabase_realtime publication
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
