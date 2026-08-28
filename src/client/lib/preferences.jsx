/**
 * Reader preferences: colour theme and reading register.
 *
 * Both are small, global, rarely-changing and persisted — context rather than
 * any kind of store.
 *
 * Reading mode is the one that matters editorially. The technical register is
 * not the plain one with jargon added: it answers a different question, usually
 * how a thing was measured and where it misleads. Both texts are stored; this
 * only chooses which is shown.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const THEME_KEY = 'diffusion:theme';
const MODE_KEY = 'diffusion:mode';

const PreferencesContext = createContext(null);

function readStored(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    // Private browsing can throw on access rather than return null.
    return fallback;
  }
}

export function PreferencesProvider({ children }) {
  // The theme is already on <html> before React mounts — an inline script in
  // index.html sets it, so a dark-mode reload does not flash light. Read the
  // element rather than storage so the two can never disagree.
  const [theme, setTheme] = useState(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light');

  const [mode, setMode] = useState(() => readStored(MODE_KEY, 'plain'));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch { /* nothing to do if storage is unavailable */ }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch { /* nothing to do if storage is unavailable */ }
  }, [mode]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(
    () => ({ theme, toggleTheme, setTheme, mode, setMode, isTechnical: mode === 'expert' }),
    [theme, toggleTheme, mode]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider');
  return value;
}

/**
 * Pick the register-appropriate text. Falls back to the plain text when a
 * technical variant was never written, so a missing field never blanks a page.
 */
export function useRegister() {
  const { isTechnical } = usePreferences();
  return useCallback(
    (plain, technical) => (isTechnical ? technical || plain : plain),
    [isTechnical]
  );
}
