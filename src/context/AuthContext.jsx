import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import {
  signIn,
  signOut,
  getProfile,
  checkUserAuthorization,
  getSanctuaryChat
} from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [partnerProfile, setPartnerProfile] = useState(null);
  const [sanctuaryChat, setSanctuaryChat] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(isSupabaseConfigured());
  const [authError, setAuthError] = useState(null);
  const loadingUserRef = useRef(null);

  // Initialize session
  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function initSession() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session?.user && isMounted) {
          setUser(session.user);
          await loadUserContext(session.user);
        } else if (isMounted) {
          setUser(null);
          setProfile(null);
          setPartnerProfile(null);
          setIsAuthorized(false);
        }
      } catch (err) {
        console.error('Session initialization error:', err);
        if (isMounted) setAuthError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        setLoading(true);
        await loadUserContext(session.user);
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setPartnerProfile(null);
        setSanctuaryChat(null);
        setIsAuthorized(false);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [configured]);

  async function loadUserContext(currentUser) {
    if (!currentUser?.id) return;
    if (loadingUserRef.current === currentUser.id) return;
    loadingUserRef.current = currentUser.id;

    try {
      // 1. Verify authorization
      const authorized = await checkUserAuthorization(currentUser.id, currentUser.email);
      setIsAuthorized(authorized);

      if (!authorized) {
        console.warn(`User ${currentUser.email} is not in the authorized sanctuary list.`);
        return;
      }

      // 2. Load profile
      let prof = null;
      try {
        prof = await getProfile(currentUser.id);
      } catch (e) {
        console.warn('Profile not yet created, using metadata fallback:', e.message);
        prof = {
          id: currentUser.id,
          display_name: currentUser.user_metadata?.display_name || currentUser.email.split('@')[0],
          avatar_url: currentUser.user_metadata?.avatar_url || ''
        };
      }
      setProfile(prof);

      // 3. Load sanctuary chat and partner
      const sanctuaryData = await getSanctuaryChat(currentUser.id);
      setSanctuaryChat(sanctuaryData.chat);
      setPartnerProfile(sanctuaryData.partner);
    } catch (err) {
      console.error('Failed to load user context:', err);
    } finally {
      loadingUserRef.current = null;
    }
  }

  const handleLogin = async (email, password) => {
    setAuthError(null);
    try {
      const data = await signIn(email, password);
      return data;
    } catch (err) {
      setAuthError(err.message || 'Login failed. Please verify your credentials.');
      throw err;
    }
  };

  const handleLogout = async () => {
    setAuthError(null);
    try {
      await signOut();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserContext(user);
    }
  };

  const value = {
    user,
    profile,
    partnerProfile,
    sanctuaryChat,
    isAuthorized,
    loading,
    configured,
    authError,
    login: handleLogin,
    logout: handleLogout,
    refreshProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
