/**
 * Reader preferences.
 *
 * One preference now: the colour theme. It is small, global, rarely-changing
 * and persisted — context rather than any kind of store.
 *
 * THE READING REGISTER WAS REMOVED, AND IT HAD NEVER WORKED
 *
 * This module used to expose a Plain/Technical mode, and `AppShell` rendered a
 * control for it. The control was wired to nothing, in two independent ways:
 * it destructured `{ register, setRegister }` from a context that exposed
 * `{ mode, setMode, isTechnical }` — both undefined — and it passed
 * `selectedValue`/`onChange` to a segmented control whose react-aria API is
 * `selectedKeys`/`onSelectionChange`. So no segment ever rendered selected,
 * clicking one updated react-aria's internal state and never touched `mode`,
 * and every reader has been on `plain` since it shipped. Nothing threw.
 *
 * Removing it was subtraction, not a decision about the feature.
 *
 * The `*_expert` columns stay in the database. There are eighteen passages of
 * real written prose in them, and the asymmetry against twenty-one `*_plain`
 * is itself the record of why the register was never finished. Unread is fine;
 * deleted is not reversible.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const THEME_KEY = 'diffusion:theme';

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

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch { /* nothing to do if storage is unavailable */ }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(
    () => ({ theme, toggleTheme, setTheme }),
    [theme, toggleTheme]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider');
  return value;
}

export { readStored };
