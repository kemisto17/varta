import type { PropsWithChildren } from 'react';
import {
  SafeAreaView,
  type SafeAreaViewProps,
} from 'react-native-safe-area-context';

const SCREEN_EDGES = ['top', 'right', 'bottom', 'left'] as const;
const TAB_SCREEN_EDGES = ['top', 'right', 'left'] as const;

type SafeAreaScreenProps = PropsWithChildren<
  Omit<SafeAreaViewProps, 'edges'> & {
    withinTabNavigator?: boolean;
  }
>;

/**
 * Applies system-bar and display-cutout insets exactly once at the screen root.
 * Tab scenes omit the bottom edge because the inset-aware tab bar owns it.
 */
export function SafeAreaScreen({
  children,
  withinTabNavigator = false,
  ...viewProps
}: SafeAreaScreenProps) {
  return (
    <SafeAreaView
      edges={withinTabNavigator ? TAB_SCREEN_EDGES : SCREEN_EDGES}
      {...viewProps}
    >
      {children}
    </SafeAreaView>
  );
}
