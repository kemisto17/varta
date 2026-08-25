import { useThemedStyles } from '../../hooks/useTheme';
import { Link } from 'expo-router';
import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, } from 'react-native';

import { spacing, type ThemeColors } from '../../constants/theme';

type AuthScaffoldProps = PropsWithChildren<{
  showBack?: boolean;
}>;

export function AuthScaffold({ children, showBack = true }: AuthScaffoldProps) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            {showBack ? (
              <Link href="/(auth)/welcome" replace asChild>
                <Pressable
                  accessibilityLabel="Back to welcome"
                  accessibilityRole="button"
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.backButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.backIcon}>←</Text>
                </Pressable>
              </Link>
            ) : (
              <View style={styles.backButton} />
            )}

            <Text style={styles.brand}>VĀRTĀ</Text>
            <View style={styles.backButton} />
          </View>

          <View style={styles.body}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  keyboardView: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },

  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backIcon: {
    fontSize: 27,
    lineHeight: 30,
    color: colors.textPrimary,
  },

  brand: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
    color: colors.textPrimary,
  },

  body: {
    flex: 1,
    paddingTop: spacing.xl,
  },

  pressed: {
    opacity: 0.5,
  },
});
