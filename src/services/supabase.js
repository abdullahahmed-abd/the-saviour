import { createClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';

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
const realtimeConfig = typeof WebSocket !== 'undefined'
  ? { params: { eventsPerSecond: 10 } }
  : {
      transport: class DummyWebSocket {
        constructor() {}
        addEventListener() {}
        removeEventListener() {}
        send() {}
        close() {}
      }
    };

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
    realtime: realtimeConfig
  }
);
