import { useThemedStyles } from '../../hooks/useTheme';
import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, } from 'react-native';

import { AuthField } from '../../components/auth/AuthField';
import { PrimaryButton } from '../../components/auth/PrimaryButton';
import { InstituteSelectField } from '../../components/profile/InstituteSelectField';
import { YearSelector } from '../../components/profile/YearSelector';
import { radius, spacing, type ThemeColors } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import {
  createStudentProfile,
  getInstitutes,
  getProfileCreationErrorMessage,
  type InstituteOption,
  normalizeUsername,
} from '../../lib/profile';

const USERNAME_PATTERN = /^[a-z0-9._]+$/;

export default function SetupProfileScreen() {
  const { styles } = useThemedStyles(createStyles);
  const { session } = useAuth();
  const { markProfileCreated } = useProfile();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState<number | null>(null);
  const [institutes, setInstitutes] = useState<InstituteOption[]>([]);
  const [selectedInstitute, setSelectedInstitute] =
    useState<InstituteOption | null>(null);
  const [isLoadingInstitutes, setIsLoadingInstitutes] = useState(true);
  const [instituteError, setInstituteError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadInstitutes = useCallback(async () => {
    setIsLoadingInstitutes(true);
    setInstituteError(null);

    try {
      const nextInstitutes = await getInstitutes();
      setInstitutes(nextInstitutes);

      if (nextInstitutes.length === 0) {
        setInstituteError('No institutes are available yet. Please try again later.');
      }
    } catch {
      setInstituteError('We could not load institutes. Check your connection.');
    } finally {
      setIsLoadingInstitutes(false);
    }
  }, []);

  useEffect(() => {
    void loadInstitutes();
  }, [loadInstitutes]);

  const handleSubmit = async () => {
    setFormError(null);

    const normalizedFullName = fullName.trim();
    const normalizedUsername = normalizeUsername(username);
    const normalizedBranch = branch.trim();

    if (normalizedFullName.length < 2 || normalizedFullName.length > 80) {
      setFormError('Enter your full name using 2 to 80 characters.');
      return;
    }

    if (
      normalizedUsername.length < 3 ||
      normalizedUsername.length > 30 ||
      !USERNAME_PATTERN.test(normalizedUsername)
    ) {
      setFormError(
        'Use 3 to 30 lowercase letters, numbers, periods, or underscores for your username.'
      );
      return;
    }

    if (!selectedInstitute) {
      setFormError('Choose your institute.');
      return;
    }

    if (normalizedBranch.length < 2 || normalizedBranch.length > 80) {
      setFormError('Enter your branch using 2 to 80 characters.');
      return;
    }

    if (!year) {
      setFormError('Choose your current year.');
      return;
    }

    if (!session?.user.id) {
      setFormError('Your session expired. Sign in again to continue.');
      return;
    }

    setIsSubmitting(true);

    try {
      const createdProfile = await createStudentProfile({
        branch: normalizedBranch,
        full_name: normalizedFullName,
        id: session.user.id,
        institute_id: selectedInstitute.id,
        username: normalizedUsername,
        year,
      });

      markProfileCreated(createdProfile);
    } catch (error) {
      setFormError(getProfileCreationErrorMessage(error));
      setIsSubmitting(false);
    }
  };

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
            <Text style={styles.brand}>VĀRTĀ</Text>
            <Text style={styles.step}>PROFILE · 1 OF 2</Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>

          <View style={styles.intro}>
            <Text style={styles.eyebrow}>MAKE IT YOURS</Text>
            <Text style={styles.title}>Set up your profile.</Text>
            <Text style={styles.subtitle}>
              A few details help Varta place you in the right campus conversation.
            </Text>
          </View>

          <View style={styles.formCard}>
            <AuthField
              autoCapitalize="words"
              autoComplete="name"
              label="Full name"
              onChangeText={setFullName}
              placeholder="Your name"
              returnKeyType="next"
              textContentType="name"
              value={fullName}
            />

            <AuthField
              autoCapitalize="none"
              autoCorrect={false}
              label="Username"
              onChangeText={setUsername}
              placeholder="campus.name"
              returnKeyType="next"
              value={username}
            />

            <View>
              <InstituteSelectField
                disabled={
                  isLoadingInstitutes || institutes.length === 0 || !!instituteError
                }
                onChange={setSelectedInstitute}
                options={institutes}
                value={selectedInstitute}
              />

              {isLoadingInstitutes ? (
                <Text style={styles.helperText}>Loading institutes…</Text>
              ) : null}

              {instituteError ? (
                <View style={styles.inlineError}>
                  <Text accessibilityRole="alert" style={styles.inlineErrorText}>
                    {instituteError}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={loadInstitutes}
                    style={({ pressed }) => pressed && styles.retryPressed}
                  >
                    <Text style={styles.retryLabel}>Retry</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <AuthField
              autoCapitalize="words"
              label="Branch"
              onChangeText={setBranch}
              placeholder="e.g. Computer Science"
              returnKeyType="done"
              value={branch}
            />

            <YearSelector onChange={setYear} value={year} />
          </View>

          {formError ? (
            <Text accessibilityRole="alert" style={styles.formError}>
              {formError}
            </Text>
          ) : null}

          <PrimaryButton
            disabled={isLoadingInstitutes || institutes.length === 0}
            isLoading={isSubmitting}
            label="Create my profile"
            onPress={handleSubmit}
          />

          <Text style={styles.privacyNote}>
            These details shape your campus experience. Student verification comes
            next—no ID is requested on this screen.
          </Text>
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
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
    width: '50%',
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

  formCard: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    gap: spacing.lg,
    backgroundColor: colors.surface,
  },

  helperText: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.textMuted,
  },

  inlineError: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  inlineErrorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: colors.danger,
  },

  retryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  retryPressed: {
    opacity: 0.5,
  },

  formError: {
    marginBottom: spacing.md,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },

  privacyNote: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
