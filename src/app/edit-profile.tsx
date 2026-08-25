import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useThemedStyles } from '../hooks/useTheme';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, } from 'react-native';

import { SafeAreaScreen } from '../components/SafeAreaScreen';
import { Avatar } from '../components/Avatar';
import { AuthField } from '../components/auth/AuthField';
import { PrimaryButton } from '../components/auth/PrimaryButton';
import { YearSelector } from '../components/profile/YearSelector';
import { radius, spacing, type ThemeColors } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { MAX_AVATAR_SIZE } from '../lib/avatars';
import { requestImageLibraryAccess } from '../lib/imagePicker';
import {
  getProfileUpdateErrorMessage,
  getUserProfile,
  MAX_BIO_CHARACTERS,
  normalizeUsername,
  updateStudentProfile,
} from '../lib/profile';

export default function EditProfileScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const router = useRouter();
  const { session } = useAuth();
  const { markProfileCreated, profile } = useProfile();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [branch, setBranch] = useState(profile?.branch ?? '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [instituteName, setInstituteName] = useState('Your verified institute');
  const [isPicking, setIsPicking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [selectedAsset, setSelectedAsset] =
    useState<ImagePickerAsset | null>(null);
  const [username, setUsername] = useState(profile?.username ?? '');
  const [year, setYear] = useState<number | null>(profile?.year ?? null);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    let isActive = true;

    if (!userId) {
      return () => {
        isActive = false;
      };
    }

    void getUserProfile(userId)
      .then((userProfile) => {
        if (!isActive || !userProfile) {
          return;
        }

        setAvatarUrl(userProfile.avatarUrl);
        setInstituteName(userProfile.institute.name);
      })
      .catch(() => {
        if (isActive) {
          setAvatarUrl(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, [userId]);

  const pickAvatar = async () => {
    if (isPicking || isSaving) {
      return;
    }

    setIsPicking(true);
    setErrorMessage(null);

    try {
      if (!(await requestImageLibraryAccess())) {
        setErrorMessage('Allow photo access to choose a profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        allowsMultipleSelection: false,
        aspect: [1, 1],
        mediaTypes: ['images'],
        quality: 0.72,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];

      if (asset.fileSize && asset.fileSize > MAX_AVATAR_SIZE) {
        setErrorMessage('Choose a profile photo smaller than 5 MB.');
        return;
      }

      setSelectedAsset(asset);
      setRemoveAvatar(false);
    } catch {
      setErrorMessage('We could not open your photo library. Please try again.');
    } finally {
      setIsPicking(false);
    }
  };

  const handleRemoveAvatar = () => {
    setSelectedAsset(null);
    setRemoveAvatar(true);
    setErrorMessage(null);
  };

  const handleSave = async () => {
    if (!userId || !profile || !year || isSaving) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const result = await updateStudentProfile({
        asset: selectedAsset,
        bio,
        branch,
        currentAvatarPath: profile.avatar_path,
        fullName,
        removeAvatar,
        userId,
        username,
        year,
      });

      markProfileCreated(result.profile);

      if (result.avatarCleanupFailed) {
        Alert.alert(
          'Profile saved',
          'Your profile is updated, but the previous photo could not be cleaned up automatically.'
        );
      }

      router.back();
    } catch (error) {
      console.warn('[edit-profile] Could not update profile.', error);
      setErrorMessage(getProfileUpdateErrorMessage(error));
      setIsSaving(false);
    }
  };

  const displayedAvatarUrl = selectedAsset?.uri ?? (removeAvatar ? null : avatarUrl);

  return (
    <SafeAreaScreen style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            disabled={isSaving}
            hitSlop={12}
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.pressed,
            ]}
          >
            <SymbolView
              name={{ android: 'arrow_back', ios: 'chevron.left', web: 'arrow_back' }}
              size={22}
              tintColor={colors.textPrimary}
            />
          </Pressable>
          <Text style={styles.headerTitle}>Edit profile</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <Text style={styles.eyebrow}>YOUR CAMPUS IDENTITY</Text>
            <Text style={styles.title}>Keep it current.</Text>
            <Text style={styles.subtitle}>
              The details students use to recognize you across Varta.
            </Text>
          </View>

          <View style={styles.avatarSection}>
            <Avatar
              fullName={fullName || 'Student'}
              size={96}
              uri={displayedAvatarUrl}
              verified={profile?.is_verified}
            />

            <View style={styles.avatarActions}>
              <Pressable
                accessibilityRole="button"
                disabled={isPicking || isSaving}
                onPress={() => void pickAvatar()}
                style={({ pressed }) => [
                  styles.photoButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.photoButtonText}>
                  {isPicking ? 'Opening photos…' : 'Choose photo'}
                </Text>
              </Pressable>

              {(profile?.avatar_path || selectedAsset) && !removeAvatar ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={handleRemoveAvatar}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.removePhotoText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.formCard}>
            <AuthField
              autoCapitalize="words"
              autoComplete="name"
              label="Full name"
              onChangeText={setFullName}
              placeholder="Your name"
              textContentType="name"
              value={fullName}
            />

            <AuthField
              autoCapitalize="none"
              autoCorrect={false}
              label="Username"
              onChangeText={(value) => setUsername(normalizeUsername(value))}
              placeholder="campus.name"
              value={username}
            />

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Institute</Text>
              <View style={styles.lockedField}>
                <Text numberOfLines={2} style={styles.lockedFieldText}>
                  {instituteName}
                </Text>
                <SymbolView
                  name={{ android: 'lock', ios: 'lock.fill', web: 'lock' }}
                  size={15}
                  tintColor={colors.textMuted}
                />
              </View>
              <Text style={styles.helperText}>
                Institute changes require a new verification review.
              </Text>
            </View>

            <AuthField
              autoCapitalize="words"
              label="Branch"
              onChangeText={setBranch}
              placeholder="e.g. Computer Science"
              value={branch}
            />

            <YearSelector onChange={setYear} value={year} />

            <View style={styles.fieldGroup}>
              <View style={styles.bioLabelRow}>
                <Text style={styles.fieldLabel}>Bio</Text>
                <Text style={styles.characterCount}>
                  {bio.length}/{MAX_BIO_CHARACTERS}
                </Text>
              </View>
              <TextInput
                maxLength={MAX_BIO_CHARACTERS}
                multiline
                onChangeText={setBio}
                placeholder="A little about you and what you care about."
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.textPrimary}
                style={styles.bioInput}
                textAlignVertical="top"
                value={bio}
              />
            </View>
          </View>

          {errorMessage ? (
            <Text accessibilityRole="alert" style={styles.errorMessage}>
              {errorMessage}
            </Text>
          ) : null}

          <PrimaryButton
            isLoading={isSaving}
            label="Save profile"
            onPress={handleSave}
          />

          <Text style={styles.privacyNote}>
            Enrollment details and verification documents are never shown on your
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

  header: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  intro: {
    marginTop: spacing.xl,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.35,
    color: colors.textMuted,
  },

  title: {
    marginTop: spacing.sm,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.7,
    color: colors.textPrimary,
  },

  subtitle: {
    maxWidth: 330,
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },

  avatarSection: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },

  avatarActions: {
    minHeight: 44,
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  photoButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  photoButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  removePhotoText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
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

  fieldGroup: {
    gap: spacing.sm,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  lockedField: {
    minHeight: 54,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },

  lockedFieldText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  helperText: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
  },

  bioLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  characterCount: {
    fontSize: 11,
    color: colors.textMuted,
  },

  bioInput: {
    minHeight: 112,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },

  errorMessage: {
    marginBottom: spacing.md,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },

  privacyNote: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 17,
    color: colors.textMuted,
  },

  pressed: {
    opacity: 0.58,
  },
});
