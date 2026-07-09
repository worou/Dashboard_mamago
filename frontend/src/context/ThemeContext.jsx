import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext(null);
export const useTheme = () => useContext(ThemeContext);

const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const ACCENTS = [
  { c: '#16B364', hi: '#24D97C' },
  { c: '#0EA5E9', hi: '#38BDF8' },
  { c: '#8B5CF6', hi: '#A78BFA' },
  { c: '#F59E0B', hi: '#FBBF24' },
];

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('mamago_theme') || 'dark');
  const [accent, setAccentState] = useState(() => {
    const c = localStorage.getItem('mamago_accent');
    return c ? ACCENTS.find((a) => a.c === c) || null : null;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    localStorage.setItem('mamago_theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (accent) {
      root.style.setProperty('--green', accent.c);
      root.style.setProperty('--green-hi', accent.hi);
      root.style.setProperty('--green-dim', rgba(accent.c, 0.15));
      localStorage.setItem('mamago_accent', accent.c);
    } else {
      root.style.removeProperty('--green');
      root.style.removeProperty('--green-hi');
      root.style.removeProperty('--green-dim');
      localStorage.removeItem('mamago_accent');
    }
  }, [accent]);

  const toggle = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), []);

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme: setThemeState, toggle, accent, setAccent: setAccentState, accents: ACCENTS, rgba }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
