import { useState, useEffect } from 'react';

const STORAGE_KEY = 'asm_shield_theme';

export function useTheme() {
  const [theme, setThemeState] = useState(() => getSavedTheme());

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return { theme, setTheme };
}

export function getSavedTheme() {
  if (typeof window === 'undefined') return 'dark';
  return localStorage.getItem(STORAGE_KEY) || 'dark';
}
