import { useContext, useMemo } from 'react';

import type { ThemeColors } from '../constants/theme';
import { ThemeContext } from '../contexts/ThemeContext';

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider.');
  }

  return context;
}

export function useThemedStyles<Styles>(
  createStyles: (colors: ThemeColors) => Styles
) {
  const theme = useTheme();
  const styles = useMemo(
    () => createStyles(theme.colors),
    [createStyles, theme.colors]
  );

  return { ...theme, styles };
}
