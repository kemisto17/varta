import { createContext } from 'react';

import type { ThemeColors } from '../constants/theme';

export type ThemePreference =
  | 'system'
  | 'light'
  | 'dark'
  | 'warm'
  | 'ocean'
  | 'forest'
  | 'warm-dark'
  | 'ocean-dark'
  | 'forest-dark';
export type ResolvedTheme = Exclude<ThemePreference, 'system'>;

export function isDarkTheme(theme: ResolvedTheme) {
  return (
    theme === 'dark' ||
    theme === 'warm-dark' ||
    theme === 'ocean-dark' ||
    theme === 'forest-dark'
  );
}

export type ThemeContextValue = {
  colors: ThemeColors;
  isReady: boolean;
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

export const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined
);
