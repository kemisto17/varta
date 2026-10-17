import storage from 'expo-sqlite/kv-store';
import * as SystemUI from 'expo-system-ui';
import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import {
  darkColors,
  forestDarkColors,
  forestColors,
  lightColors,
  oceanDarkColors,
  oceanColors,
  type ThemeColors,
  warmDarkColors,
  warmColors,
} from '../constants/theme';
import {
  isDarkTheme,
  ThemeContext,
  type ThemeContextValue,
  type ThemePreference,
  type ResolvedTheme,
} from '../contexts/ThemeContext';

const THEME_PREFERENCE_KEY = 'varta:theme-preference';
const THEME_COLORS: Record<ResolvedTheme, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
  warm: warmColors,
  ocean: oceanColors,
  forest: forestColors,
  'warm-dark': warmDarkColors,
  'ocean-dark': oceanDarkColors,
  'forest-dark': forestDarkColors,
};

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemTheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);
  const [preference, setPreferenceState] =
    useState<ThemePreference>('system');

  useEffect(() => {
    let isActive = true;

    void storage
      .getItem(THEME_PREFERENCE_KEY)
      .then((storedPreference) => {
        if (!isActive) {
          return;
        }

        const nextPreference = isThemePreference(storedPreference)
          ? storedPreference
          : 'system';
        applyNativePreference(nextPreference);
        setPreferenceState(nextPreference);
      })
      .catch((error: unknown) => {
        console.warn('[theme] Could not load the saved appearance.', error);
      })
      .finally(() => {
        if (isActive) {
          setIsReady(true);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const resolvedTheme =
    preference === 'system'
      ? systemTheme === 'dark'
        ? 'dark'
        : 'light'
      : preference;
  const colors = THEME_COLORS[resolvedTheme];

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background).catch(
      (error: unknown) => {
        console.warn('[theme] Could not update the native background.', error);
      }
    );
  }, [colors.background]);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    applyNativePreference(nextPreference);
    setPreferenceState(nextPreference);
    void storage.setItem(THEME_PREFERENCE_KEY, nextPreference).catch(
      (error: unknown) => {
        console.warn('[theme] Could not save the appearance.', error);
      }
    );
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors,
      isReady,
      preference,
      resolvedTheme,
      setPreference,
    }),
    [colors, isReady, preference, resolvedTheme, setPreference]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

function isThemePreference(value: string | null): value is ThemePreference {
  return (
    value === 'system' ||
    value === 'light' ||
    value === 'dark' ||
    value === 'warm' ||
    value === 'ocean' ||
    value === 'forest' ||
    value === 'warm-dark' ||
    value === 'ocean-dark' ||
    value === 'forest-dark'
  );
}

function applyNativePreference(preference: ThemePreference) {
  Appearance.setColorScheme(
    preference === 'system'
      ? 'unspecified'
      : isDarkTheme(preference)
        ? 'dark'
        : 'light'
  );
}
