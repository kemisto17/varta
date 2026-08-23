import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PrimaryButton } from '../../components/auth/PrimaryButton';
import { colors, radius, spacing } from '../../constants/theme';
import { useProfile } from '../../hooks/useProfile';

export default function VerificationPendingScreen() {
  const { continueToApp, profile } = useProfile();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>VĀRTĀ</Text>
          <Text style={styles.step}>PROFILE · 2 OF 2</Text>
        </View>

        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <View style={styles.hero}>
          <View style={styles.successMark}>
            <Text style={styles.successIcon}>✓</Text>
          </View>

          <Text style={styles.eyebrow}>PROFILE CREATED</Text>
          <Text style={styles.title}>You’re ready for what’s next.</Text>
          <Text style={styles.subtitle}>
            Welcome, {profile?.full_name ?? 'student'}. Your campus profile is in
            place. Student verification will be added in the next milestone.
          </Text>
        </View>

        <View style={styles.timeline}>
          <View style={styles.timelineRow}>
            <View style={styles.timelineIndexDone}>
              <Text style={styles.timelineIndexDoneText}>01</Text>
            </View>
            <View style={styles.timelineCopy}>
              <Text style={styles.timelineTitle}>Profile complete</Text>
              <Text style={styles.timelineDescription}>
                Your name, institute, branch, and year are saved.
              </Text>
            </View>
            <Text style={styles.completeLabel}>DONE</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.timelineRow}>
            <View style={styles.timelineIndexNext}>
              <Text style={styles.timelineIndexNextText}>02</Text>
            </View>
            <View style={styles.timelineCopy}>
              <Text style={styles.timelineTitle}>Student verification</Text>
              <Text style={styles.timelineDescription}>
                Enrollment and student ID checks are coming next.
              </Text>
            </View>
            <Text style={styles.nextLabel}>NEXT</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <PrimaryButton label="Continue to Vārtā" onPress={continueToApp} />
          <Text style={styles.note}>
            Verification is not being collected yet. You can continue into the app
            for development testing.
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },

  header: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  brand: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 3.2,
    color: colors.textPrimary,
  },

  step: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: colors.textMuted,
  },

  progressTrack: {
    height: 2,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },

  progressFill: {
    width: '100%',
    height: 2,
    borderRadius: radius.full,
    backgroundColor: colors.textPrimary,
  },

  hero: {
    marginTop: spacing.xxl,
  },

  successMark: {
    width: 52,
    height: 52,
    marginBottom: spacing.lg,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textPrimary,
  },

  successIcon: {
    fontSize: 23,
    fontWeight: '700',
    color: colors.white,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: colors.success,
  },

  title: {
    maxWidth: 350,
    marginTop: spacing.sm,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '700',
    letterSpacing: -1,
    color: colors.textPrimary,
  },

  subtitle: {
    maxWidth: 350,
    marginTop: spacing.md,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textSecondary,
  },

  timeline: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },

  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  timelineIndexDone: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textPrimary,
  },

  timelineIndexDoneText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
  },

  timelineIndexNext: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  timelineIndexNextText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },

  timelineCopy: {
    flex: 1,
    marginHorizontal: spacing.md,
  },

  timelineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  timelineDescription: {
    marginTop: spacing.xs,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  completeLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.success,
  },

  nextLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textMuted,
  },

  divider: {
    height: 1,
    marginVertical: spacing.md,
    marginLeft: 50,
    backgroundColor: colors.borderSubtle,
  },

  footer: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
  },

  note: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
