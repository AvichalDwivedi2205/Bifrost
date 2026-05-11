'use client';
import React, { createContext, useContext, useEffect } from 'react';

type Theme = 'dark';

interface ThemeCtxValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeCtx = createContext<ThemeCtxValue>({ theme: 'dark', toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    try { localStorage.removeItem('bf-theme'); } catch { /* ignore */ }
  }, []);

  return <ThemeCtx.Provider value={{ theme: 'dark', toggle: () => {} }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
