import storage from 'expo-sqlite/kv-store';
import * as SystemUI from 'expo-system-ui';
import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { darkColors, lightColors } from '../constants/theme';
import {
  ThemeContext,
  type ThemeContextValue,
  type ThemePreference,
} from '../contexts/ThemeContext';

const THEME_PREFERENCE_KEY = 'varta:theme-preference';

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
  const colors = resolvedTheme === 'dark' ? darkColors : lightColors;

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
  return value === 'system' || value === 'light' || value === 'dark';
}

function applyNativePreference(preference: ThemePreference) {
  Appearance.setColorScheme(
    preference === 'system' ? 'unspecified' : preference
  );
}
