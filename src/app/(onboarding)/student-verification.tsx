import type { ImagePickerAsset } from 'expo-image-picker';
import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useThemedStyles } from '../../hooks/useTheme';

import { AuthField } from '../../components/auth/AuthField';
import { PrimaryButton } from '../../components/auth/PrimaryButton';
import { SafeAreaScreen } from '../../components/SafeAreaScreen';
import { StudentIdPicker } from '../../components/verification/StudentIdPicker';
import { radius, spacing, type ThemeColors } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import { useVerification } from '../../hooks/useVerification';
import {
  getVerificationErrorMessage,
  submitStudentVerification,
} from '../../lib/verification';

export default function StudentVerificationScreen() {
  const { styles } = useThemedStyles(createStyles);
  const { session } = useAuth();
  const { profile } = useProfile();
  const { markVerificationSubmitted } = useVerification();
  const [enrollmentNumber, setEnrollmentNumber] = useState('');
  const [studentId, setStudentId] = useState<ImagePickerAsset | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setErrorMessage(null);

    const normalizedEnrollmentNumber = enrollmentNumber.trim();

    if (
      normalizedEnrollmentNumber.length < 3 ||
      normalizedEnrollmentNumber.length > 50
    ) {
      setErrorMessage('Enter a valid enrollment number using 3 to 50 characters.');
      return;
    }

    if (!studentId) {
      setErrorMessage('Choose a clear image of your college or student ID.');
      return;
    }

    if (!session?.user.id || !profile) {
      setErrorMessage('Your session expired. Sign in again to continue.');
      return;
    }

    setIsSubmitting(true);

    try {
      const verification = await submitStudentVerification({
        asset: studentId,
        enrollmentNumber: normalizedEnrollmentNumber,
        instituteId: profile.institute_id,
        userId: session.user.id,
      });

      markVerificationSubmitted(verification);
    } catch (error) {
      setErrorMessage(getVerificationErrorMessage(error));
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaScreen style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.brand}>VĀRTĀ</Text>
            <Text style={styles.step}>VERIFY · 2 OF 2</Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>

          <View style={styles.intro}>
            <Text style={styles.eyebrow}>CAMPUS ACCESS</Text>
            <Text style={styles.title}>Confirm you’re a student.</Text>
            <Text style={styles.subtitle}>
              One private check keeps Varta’s campus conversation limited to
              students.
            </Text>
          </View>

          <View style={styles.privacyCard}>
            <View style={styles.privacyMark}>
              <Text style={styles.privacyMarkText}>V</Text>
            </View>
            <View style={styles.privacyCopy}>
              <Text style={styles.privacyEyebrow}>PRIVATE BY DESIGN</Text>
              <Text style={styles.privacyText}>
                Your student ID is used only to verify that you study at SVVV.
              </Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <AuthField
              autoCapitalize="characters"
              autoCorrect={false}
              label="Enrollment number"
              onChangeText={setEnrollmentNumber}
              placeholder="Your enrollment number"
              returnKeyType="done"
              value={enrollmentNumber}
            />

            <StudentIdPicker
              asset={studentId}
              onChange={setStudentId}
              onError={setErrorMessage}
            />
          </View>

          {errorMessage ? (
            <Text accessibilityRole="alert" style={styles.errorMessage}>
              {errorMessage}
            </Text>
          ) : null}

          <PrimaryButton
            disabled={!studentId}
            isLoading={isSubmitting}
            label="Submit for verification"
            onPress={handleSubmit}
          />

          <Text style={styles.note}>
            Your document stays in private storage and is never published on your
            profile.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaScreen>
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
    paddingBottom: 140,
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

  intro: {
    marginTop: spacing.xl,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: colors.textMuted,
  },

  title: {
    maxWidth: 350,
    marginTop: spacing.sm,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -0.9,
    color: colors.textPrimary,
  },

  subtitle: {
    maxWidth: 340,
    marginTop: spacing.sm,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },

  privacyCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },

  privacyMark: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textPrimary,
  },

  privacyMarkText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },

  privacyCopy: {
    flex: 1,
    marginLeft: spacing.md,
  },

  privacyEyebrow: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: colors.success,
  },

  privacyText: {
    marginTop: spacing.xs,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary,
  },

  formCard: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    gap: spacing.lg,
    backgroundColor: colors.surface,
  },

  errorMessage: {
    marginBottom: spacing.md,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
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
