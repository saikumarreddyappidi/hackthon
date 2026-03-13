import React, { createContext, useContext, useState } from 'react';
import API from './api';
import { LS_QUIZ_RESULTS } from './config';

const AuthContext = createContext(null);
const SESSION_START_KEY = 'smartstudy_session_start';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading] = useState(false);

  const login = async (email, password) => {
    const res = await API.post('/login', { email, password });
    const { access_token, user: userData } = res.data;
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem(SESSION_START_KEY, new Date().toISOString());
    setUser(userData);
    return userData;
  };

  const signup = async (data) => {
    const res = await API.post('/signup', data);
    const { access_token, user: userData } = res.data;
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem(SESSION_START_KEY, new Date().toISOString());
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    const activeUser = user || (() => {
      try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
    })();

    const startedAt = localStorage.getItem(SESSION_START_KEY);
    const sessionMinutes = startedAt
      ? Math.max(0, (Date.now() - new Date(startedAt).getTime()) / 60000)
      : 0;

    let quizAttempts = [];
    try {
      const raw = JSON.parse(localStorage.getItem(LS_QUIZ_RESULTS) || '[]');
      quizAttempts = (Array.isArray(raw) ? raw : []).slice(-20).map((q) => ({
        topic: q?.topic || 'Study Kit',
        score: Number(q?.score || 0),
        total: Number(q?.total || 0),
        accuracy: Number(q?.accuracy || 0),
        timestamp: q?.timestamp || null,
      }));
    } catch {
      quizAttempts = [];
    }

    if (activeUser?.id) {
      try {
        await API.post(`/logout-email/${activeUser.id}`, {
          session_minutes: Number(sessionMinutes.toFixed(2)),
          quiz_attempts: quizAttempts,
        });
      } catch {
        // Logout should still proceed even if email sending fails.
      }
    }

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem(SESSION_START_KEY);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await API.get('/me');
      localStorage.setItem('user', JSON.stringify(res.data));
      if (!localStorage.getItem(SESSION_START_KEY)) {
        localStorage.setItem(SESSION_START_KEY, new Date().toISOString());
      }
      setUser(res.data);
    } catch (e) {
      await logout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
