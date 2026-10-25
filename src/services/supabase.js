import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = () => {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !supabaseUrl.includes('your-project-ref') &&
    !supabaseAnonKey.includes('your_anon_key_here') &&
    !supabaseAnonKey.includes('PASTE_YOUR') &&
    supabaseAnonKey !== 'placeholder-anon-key'
  );
};

// Initialize the Supabase Client
// CRITICAL SECURITY NOTE: Only the public anon key is initialized here.
// Row Level Security (RLS) policies on the PostgreSQL database enforce all access control.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'the-saviour-auth'
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
);
