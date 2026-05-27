/**
 * VIGIL — useAuth hook
 *
 * Place this file at:
 *   frontend/patient-app/src/hooks/useAuth.js
 *   frontend/physician-dashboard/src/hooks/useAuth.js
 * (same file in both apps — copy it to both)
 *
 * Usage:
 *   const { user, token, logout, loading } = useAuth();
 */

import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "vigil_token";

// Decode JWT payload without library (it's just base64url)
function decodeJWT(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function getInitials(name, email, phone) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  if (phone) return phone.slice(-2);
  return "?";
}

export function useAuth() {
  const [user, setUser]     = useState(null);
  const [token, setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, rehydrate from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      const payload = decodeJWT(stored);
      if (payload && payload.exp * 1000 > Date.now()) {
        setToken(stored);
        setUser({
          id:       payload.sub,
          name:     payload.name || "",
          email:    payload.email || "",
          phone:    payload.phone || "",
          role:     payload.role,
          picture:  payload.pic  || "",
          initials: getInitials(payload.name, payload.email, payload.phone),
        });
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    setLoading(false);
  }, []);

  const saveSession = useCallback((accessToken) => {
    const payload = decodeJWT(accessToken);
    if (!payload) return;
    localStorage.setItem(TOKEN_KEY, accessToken);
    setToken(accessToken);
    setUser({
      id:       payload.sub,
      name:     payload.name || "",
      email:    payload.email || "",
      phone:    payload.phone || "",
      role:     payload.role,
      picture:  payload.pic  || "",
      initials: getInitials(payload.name, payload.email, payload.phone),
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` },
      });
    } catch { /* ignore network errors on logout */ }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    // Redirect to login page
    window.location.href = import.meta.env.VITE_LOGIN_URL || "http://localhost:3000";
  }, []);

  const sendEmergencyAlert = useCallback(async (message = "Emergency! Patient needs help.") => {
    if (!user) return { error: "Not logged in" };
    const res = await fetch(`${API}/auth/emergency-alert`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${localStorage.getItem(TOKEN_KEY)}`,
      },
      body: JSON.stringify({
        patient_id:   user.id,
        patient_name: user.name || user.phone || user.email,
        message,
      }),
    });
    return res.json();
  }, [user]);

  return { user, token, loading, saveSession, logout, sendEmergencyAlert };
}

// ── API helpers (re-exported for convenience) ────────────────────────────────

export const authAPI = {
  sendOTP: async (phone, role) => {
    const res = await fetch(`${API}/auth/send-otp`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ phone, role }),
    });
    return res.json();
  },

  verifyOTP: async (phone, code, role) => {
    const res = await fetch(`${API}/auth/verify-otp`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ phone, code, role }),
    });
    if (!res.ok) throw new Error("Invalid OTP");
    return res.json();
  },

  googleLogin: async (idToken, role) => {
    const res = await fetch(`${API}/auth/google`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id_token: idToken, role }),
    });
    if (!res.ok) throw new Error("Google login failed");
    return res.json();
  },

  getAlerts: async (token) => {
    const res = await fetch(`${API}/auth/emergency-alerts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  },

  acknowledgeAlert: async (alertId, token) => {
    const res = await fetch(`${API}/auth/emergency-alerts/${alertId}/acknowledge`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  },
};
