import { useState, useEffect } from 'react';

// Listeners to synchronize theme state across multiple hook callers
let listeners = [];
function notifyListeners(newMode) {
  listeners.forEach((fn) => fn(newMode));
}

function getStoredMode() {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem('themeMode') || localStorage.getItem('theme');
  if (stored && ['system', 'light', 'dark'].includes(stored)) {
    return stored;
  }
  return 'system';
}

function getSystemPrefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useTheme() {
  const [mode, setModeState] = useState(getStoredMode);
  const [systemIsDark, setSystemIsDark] = useState(getSystemPrefersDark);

  // Subscribe to state updates from other useTheme callers
  useEffect(() => {
    const update = (m) => setModeState(m);
    listeners.push(update);
    return () => {
      listeners = listeners.filter((l) => l !== update);
    };
  }, []);

  // Listen to OS / device dark mode preference changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Set initial value in case it changed before mount
    setSystemIsDark(mediaQuery.matches);

    const handler = (e) => {
      setSystemIsDark(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Compute effective theme: 'dark' or 'light'
  const resolvedTheme = mode === 'system' ? (systemIsDark ? 'dark' : 'light') : mode;

  // Apply or remove .dark class on the root html element
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = window.document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  const setMode = (newMode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('themeMode', newMode);
      localStorage.setItem('theme', newMode);
    }
    setModeState(newMode);
    notifyListeners(newMode);
  };

  const toggleTheme = () => {
    // Cycle: system -> light -> dark -> system
    const next = mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system';
    setMode(next);
  };

  return {
    theme: resolvedTheme, // 'light' | 'dark' for compatibility
    mode,                 // 'system' | 'light' | 'dark'
    setMode,
    toggleTheme,
    isDark: resolvedTheme === 'dark',
  };
}
