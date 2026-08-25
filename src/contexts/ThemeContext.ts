import { createContext } from 'react';

import type { ThemeColors } from '../constants/theme';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

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
