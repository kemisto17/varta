import { Link } from 'expo-router';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radius, spacing } from '../../constants/theme';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={styles.brand}>VĀRTĀ</Text>
          <Text style={styles.brandNote}>THE CAMPUS CONVERSATION</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.title}>Your campus,{`\n`}in one conversation.</Text>
          <Text style={styles.subtitle}>
            Discover what matters, share what is happening, and stay close to
            your student community.
          </Text>
        </View>

        <View style={styles.actions}>
          <Link href="/(auth)/register" asChild>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryPressed,
              ]}
            >
              <Text style={styles.primaryLabel}>Create an account</Text>
            </Pressable>
          </Link>

          <Link href="/(auth)/login" asChild>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryPressed,
              ]}
            >
              <Text style={styles.secondaryLabel}>I already have an account</Text>
            </Pressable>
          </Link>

          <Text style={styles.footerNote}>
            One campus. Every conversation.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    flexGrow: 1,
    minHeight: '100%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    justifyContent: 'space-between',
  },

  brand: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 4,
    color: colors.textPrimary,
  },

  brandNote: {
    marginTop: spacing.sm,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: colors.textMuted,
  },

  hero: {
    marginVertical: spacing.xxl,
  },

  title: {
    maxWidth: 350,
    fontSize: 43,
    lineHeight: 49,
    fontWeight: '700',
    letterSpacing: -1.3,
    color: colors.textPrimary,
  },

  subtitle: {
    maxWidth: 340,
    marginTop: spacing.lg,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
  },

  actions: {
    gap: spacing.md,
  },

  primaryButton: {
    minHeight: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textPrimary,
  },

  primaryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },

  secondaryButton: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  secondaryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  primaryPressed: {
    opacity: 0.8,
  },

  secondaryPressed: {
    backgroundColor: colors.borderSubtle,
  },

  footerNote: {
    marginTop: spacing.sm,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
