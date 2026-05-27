import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleAuth = async () => {
      // 1. Check if there is an access_token in the URL hash
      const hash = window.location.hash;
      if (hash && hash.includes('access_token=')) {
        const params = new URLSearchParams(hash.substring(1)); // Remove the '#'
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        
        if (accessToken && refreshToken) {
          try {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            // Clear the hash from the URL so it looks clean
            window.history.replaceState(null, null, window.location.pathname);
          } catch (e) {
            console.error('Failed to set session from URL hash:', e);
          }
        }
      }

      // 2. Get current session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      if (currentSession?.user) {
        setUser({
          id: currentSession.user.id,
          email: currentSession.user.email,
          role: currentSession.user.user_metadata?.role || 'patient',
          name: currentSession.user.user_metadata?.full_name || 'Dr. Shepherd',
        });
      }
      setLoading(false);
    };

    handleAuth();

    // 3. Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (currentSession?.user) {
        setUser({
          id: currentSession.user.id,
          email: currentSession.user.email,
          role: currentSession.user.user_metadata?.role || 'patient',
          name: currentSession.user.user_metadata?.full_name || 'Dr. Shepherd',
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('aegis_session');
    window.location.href = import.meta.env.VITE_LOGIN_URL || "http://localhost:3007";
  }, []);

  return { user, session, loading, logout };
}
