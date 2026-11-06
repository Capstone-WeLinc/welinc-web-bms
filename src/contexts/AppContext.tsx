/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '../lib/types';
import { logout as doLogout, getCurrentUser, mapBackendUser } from '../lib/auth';
import { api } from '../lib/api';
import { toast } from 'sonner';

interface AppContextType {
  user: User |
   null;
  setUser: (u: User | null) => void;
  logout: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          api.defaults.headers.common.Authorization = `Bearer ${token}`;
        }
      } catch {
        // ignore localStorage access errors
      }
    }
    return currentUser;
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem('welinc_theme');
    return stored === 'dark';
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('welinc_sidebar') === 'collapsed';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem('token');
    if (!token) return;

    api.get('/auth/me')
      .then((res) => {
        if (mounted) {
          const mapped = mapBackendUser(res.data);
          setUser(mapped);
          try {
            localStorage.setItem('welinc_user', JSON.stringify(mapped));
          } catch {
            // ignore localStorage access errors
          }
        }
      })
      .catch(() => {
        // keep the token-decoded user if the request fails
      });

    return () => { mounted = false; };
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('welinc_theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('welinc_sidebar', next ? 'collapsed' : 'expanded');
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    doLogout();
    setUser(null);
    toast.success('Logged out successfully');
  }, []);

  return (
    <AppContext.Provider value={{ user, setUser, logout, darkMode, toggleDarkMode, sidebarCollapsed, toggleSidebar }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
