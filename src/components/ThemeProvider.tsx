'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', setTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    // Read from localStorage (set by inline script for flash prevention)
    const stored = localStorage.getItem('mainline-theme') as Theme | null;
    if (stored === 'dark' || stored === 'light') {
      setThemeState(stored);
    }

    // Also check server settings for authoritative value
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.theme === 'dark' || data?.theme === 'light') {
          setThemeState(data.theme);
          localStorage.setItem('mainline-theme', data.theme);
          document.documentElement.classList.toggle('dark', data.theme === 'dark');
        }
      })
      .catch(() => {});
  }, []);

  function setTheme(newTheme: Theme) {
    setThemeState(newTheme);
    localStorage.setItem('mainline-theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');

    // Persist to server
    fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: newTheme }),
    }).catch(() => {});
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
