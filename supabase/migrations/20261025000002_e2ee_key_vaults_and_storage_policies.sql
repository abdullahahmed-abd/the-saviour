-- ==============================================================================
-- THE SAVIOUR — END-TO-END ENCRYPTION (E2EE) SCHEMA & STORAGE MIGRATION
-- Migration: 20261025000002_e2ee_key_vaults_and_storage_policies.sql
-- 
-- PURPOSE:
-- 1. Create separate tables for Public Identity Keys and Owner-Only Encrypted Vaults.
-- 2. Enforce strict Row Level Security (RLS):
--    - Public keys are readable by authorized sanctuary members.
--    - Encrypted vaults are readable ONLY by their respective owner (auth.uid() = user_id).
-- 3. Enable Supabase Realtime for public key publication (instant key discovery).
-- 4. Verify precondition: Fails clearly if 'chat-photos' bucket does not exist.
-- 5. Update Supabase Storage for 'chat-photos':
--    - Permit 'application/octet-stream' MIME type for encrypted .enc files.
--    - Explicitly drop conflicting policies from initial schema.
--    - Enforce chat-membership validation and ownership on SELECT, INSERT, and DELETE.
-- 
-- SAFETY GUARANTEES:
-- - Zero data deletion: Preserves all existing messages, reactions, accounts, and profiles.
-- - No TRUNCATE or CASCADE operations.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. USER E2EE PUBLIC KEYS TABLE
-- Stores public ECDH P-256 identity keys for chat key agreement & Safety Numbers.
-- Accessible to authorized sanctuary members.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_e2ee_public_keys (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    public_key JSONB NOT NULL,
    key_fingerprint TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for rapid fingerprint lookups and anti-MITM verification
CREATE INDEX IF NOT EXISTS idx_user_e2ee_public_keys_fingerprint 
    ON public.user_e2ee_public_keys(key_fingerprint);

ALTER TABLE public.user_e2ee_public_keys ENABLE ROW LEVEL SECURITY;

-- RLS: Authorized whitelist users can view public keys (needed for ECDH shared secret derivation)
DROP POLICY IF EXISTS "Authorized users can view public keys" ON public.user_e2ee_public_keys;
CREATE POLICY "Authorized users can view public keys"
    ON public.user_e2ee_public_keys
    FOR SELECT
    TO authenticated
    USING (public.is_authorized());

-- RLS: Users can publish or update their own public key
DROP POLICY IF EXISTS "Users can insert their own public key" ON public.user_e2ee_public_keys;
CREATE POLICY "Users can insert their own public key"
    ON public.user_e2ee_public_keys
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id AND public.is_authorized());

DROP POLICY IF EXISTS "Users can update their own public key" ON public.user_e2ee_public_keys;
CREATE POLICY "Users can update their own public key"
    ON public.user_e2ee_public_keys
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id AND public.is_authorized())
    WITH CHECK (auth.uid() = user_id AND public.is_authorized());

DROP POLICY IF EXISTS "Users can delete their own public key" ON public.user_e2ee_public_keys;
CREATE POLICY "Users can delete their own public key"
    ON public.user_e2ee_public_keys
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id AND public.is_authorized());


-- ------------------------------------------------------------------------------
-- 2. USER E2EE ENCRYPTED VAULTS TABLE (OWNER-ONLY ACCESS)
-- Stores PBKDF2-encrypted (600,000 rounds) private key backups.
-- CRITICAL SECURITY RULE: Readable ONLY by the owning user (auth.uid() = user_id).
-- The partner cannot read this table under any circumstances.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_e2ee_vaults (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    encrypted_private_key TEXT NOT NULL,
    key_salt TEXT NOT NULL,
    key_iv TEXT NOT NULL,
    key_kdf_iterations INTEGER NOT NULL DEFAULT 600000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_e2ee_vaults ENABLE ROW LEVEL SECURITY;

-- RLS: STRICT OWNER-ONLY SELECT. Partner cannot read another user's encrypted vault.
DROP POLICY IF EXISTS "Users can read only their own encrypted vault" ON public.user_e2ee_vaults;
CREATE POLICY "Users can read only their own encrypted vault"
    ON public.user_e2ee_vaults
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id AND public.is_authorized());

-- RLS: Users can insert their own encrypted vault
DROP POLICY IF EXISTS "Users can insert their own encrypted vault" ON public.user_e2ee_vaults;
CREATE POLICY "Users can insert their own encrypted vault"
    ON public.user_e2ee_vaults
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id AND public.is_authorized());

-- RLS: Users can update their own encrypted vault
DROP POLICY IF EXISTS "Users can update their own encrypted vault" ON public.user_e2ee_vaults;
CREATE POLICY "Users can update their own encrypted vault"
    ON public.user_e2ee_vaults
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id AND public.is_authorized())
    WITH CHECK (auth.uid() = user_id AND public.is_authorized());

-- RLS: Users can delete their own encrypted vault
DROP POLICY IF EXISTS "Users can delete their own encrypted vault" ON public.user_e2ee_vaults;
CREATE POLICY "Users can delete their own encrypted vault"
    ON public.user_e2ee_vaults
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id AND public.is_authorized());


-- ------------------------------------------------------------------------------
-- 3. REALTIME REPLICATION CONFIGURATION
-- Replicate public key changes to notify partner clients of new keys.
-- Do NOT replicate private vaults over websockets.
-- ------------------------------------------------------------------------------
ALTER TABLE public.user_e2ee_public_keys REPLICA IDENTITY FULL;

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_e2ee_public_keys;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;


-- ------------------------------------------------------------------------------
-- 4. STORAGE BUCKET PRECONDITION & CONFIGURATION ('chat-photos')
-- Fails clearly if 'chat-photos' bucket does not exist.
-- Updates allowed MIME types to include 'application/octet-stream' for encrypted .enc files.
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM storage.buckets WHERE id = 'chat-photos'
    ) THEN
        RAISE EXCEPTION 'Migration Precondition Failed: Storage bucket "chat-photos" does not exist in storage.buckets.';
    END IF;
END $$;

UPDATE storage.buckets
SET 
    allowed_mime_types = ARRAY[
        'application/octet-stream',
        'image/webp',
        'image/jpeg',
        'image/png'
    ],
    file_size_limit = 5242880 -- 5 MB
WHERE id = 'chat-photos';


-- ------------------------------------------------------------------------------
-- 5. STORAGE ROW LEVEL SECURITY (RLS) FOR 'chat-photos'
-- ------------------------------------------------------------------------------

-- Helper security function: strictly validates chat membership for the object path.
-- Path convention: photos/<chatId>/<userId>/<filename>
-- Zero root or legacy fallback: caller MUST be an active member of <chatId>.
CREATE OR REPLACE FUNCTION public.can_access_chat_photo(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    (storage.foldername(object_name))[1] = 'photos'
    AND (storage.foldername(object_name))[2] IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.chat_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.chat_id::text = (storage.foldername(object_name))[2]
    );
$$;

-- ------------------------------------------------------------------------------
-- Conflicting Policy Cleanup on storage.objects:
-- The initial schema (20261025000000) defined three broad policies on 'chat-photos':
-- 1. "Authorized users can read chat photos" — Permitted any authorized user to read all files in chat-photos without checking chat membership.
-- 2. "Authorized users can upload chat photos" — Permitted any authorized user to upload to any folder.
-- 3. "Users can delete their own chat photos" — Did not verify chat membership.
-- We explicitly drop these 3 conflicting policies before applying the chat-membership-restricted replacements.
-- Unrelated storage policies for other buckets (if any) are strictly untouched.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authorized users can read chat photos" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users can upload chat photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own chat photos" ON storage.objects;

-- Also drop current migration policy names to ensure clean idempotency if re-run:
DROP POLICY IF EXISTS "Authorized chat members can read chat photos" ON storage.objects;
DROP POLICY IF EXISTS "Authorized chat members can upload chat photos" ON storage.objects;
DROP POLICY IF EXISTS "Authorized chat members can delete their own chat photos" ON storage.objects;

-- RLS: Download/Read policy
-- Requires: correct bucket + authorized whitelist user + verified chat membership
CREATE POLICY "Authorized chat members can read chat photos"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'chat-photos' 
        AND public.is_authorized()
        AND public.can_access_chat_photo(name)
    );

-- RLS: Upload policy
-- Requires: correct bucket + authorized whitelist user + photos folder + uploader ownership + verified chat membership
CREATE POLICY "Authorized chat members can upload chat photos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'chat-photos'
        AND public.is_authorized()
        AND (storage.foldername(name))[1] = 'photos'
        AND (storage.foldername(name))[3] = auth.uid()::text
        AND EXISTS (
            SELECT 1 FROM public.chat_members cm
            WHERE cm.user_id = auth.uid()
              AND cm.chat_id::text = (storage.foldername(name))[2]
        )
    );

-- RLS: Delete policy
-- Requires: correct bucket + authorized whitelist user + photos folder + uploader ownership + CURRENT chat membership
CREATE POLICY "Authorized chat members can delete their own chat photos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'chat-photos'
        AND public.is_authorized()
        AND (storage.foldername(name))[1] = 'photos'
        AND (storage.foldername(name))[3] = auth.uid()::text
        AND EXISTS (
            SELECT 1 FROM public.chat_members cm
            WHERE cm.user_id = auth.uid()
              AND cm.chat_id::text = (storage.foldername(name))[2]
        )
    );
