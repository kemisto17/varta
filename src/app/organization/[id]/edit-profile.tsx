import type { ImagePickerAsset } from 'expo-image-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AuthField } from '../../../components/auth/AuthField';
import { PrimaryButton } from '../../../components/auth/PrimaryButton';
import { Avatar } from '../../../components/Avatar';
import { SafeAreaScreen } from '../../../components/SafeAreaScreen';
import {
  radius,
  spacing,
  type ThemeColors,
} from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { useThemedStyles } from '../../../hooks/useTheme';
import { requestImageLibraryAccess } from '../../../lib/imagePicker';
import { isUuid } from '../../../lib/identifiers';
import {
  canManageOrganizationProfile,
  getOrganizationById,
  getOrganizationUpdateErrorMessage,
  MAX_ORGANIZATION_AVATAR_SIZE,
  MAX_ORGANIZATION_DESCRIPTION_CHARACTERS,
  updateOrganizationProfile,
} from '../../../lib/organizations';
import type { CampusOrganization } from '../../../types/organization';

export default function EditOrganizationProfileScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const router = useRouter();

  const params = useLocalSearchParams<{
    id: string | string[];
  }>();

  const organizationId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [organization, setOrganization] =
    useState<CampusOrganization | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const [selectedAsset, setSelectedAsset] =
    useState<ImagePickerAsset | null>(null);

  const [removeAvatar, setRemoveAvatar] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isPicking, setIsPicking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const pickingRef = useRef(false);
  const savePendingRef = useRef(false);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else if (isUuid(organizationId)) {
      router.replace({
        pathname: '/organization/[id]',
        params: { id: organizationId },
      });
    } else {
      router.replace('/');
    }
  };

  useEffect(() => {
    let active = true;

    const loadOrganization = async () => {
      if (!isUuid(organizationId) || !userId) {
        if (active) {
          setIsLoading(false);
        }

        return;
      }

      try {
        const nextOrganization = await getOrganizationById(
          organizationId,
          userId
        );

        if (
          !nextOrganization ||
          !canManageOrganizationProfile(nextOrganization.role)
        ) {
          if (active) {
            setOrganization(null);
          }

          return;
        }

        if (!active) {
          return;
        }

        setOrganization(nextOrganization);
        setName(nextOrganization.name);
        setDescription(nextOrganization.description ?? '');
      } catch (error) {
        console.warn(
          '[organization-edit-profile] Could not load organization.',
          error
        );

        if (active) {
          setErrorMessage(
            'We could not load this organization. Try again.'
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadOrganization();

    return () => {
      active = false;
    };
  }, [organizationId, userId]);

  const pickAvatar = async () => {
    if (pickingRef.current || savePendingRef.current) {
      return;
    }

    pickingRef.current = true;
    setIsPicking(true);
    setErrorMessage(null);

    try {
      const hasAccess = await requestImageLibraryAccess();

      if (!hasAccess) {
        setErrorMessage(
          'Allow photo access to choose an organization photo.'
        );

        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          allowsEditing: true,
          allowsMultipleSelection: false,
          aspect: [1, 1],
          mediaTypes: ['images'],
          quality: 0.72,
        });

      if (
        result.canceled ||
        result.assets.length === 0
      ) {
        return;
      }

      const asset = result.assets[0];

      if (
        asset.fileSize &&
        asset.fileSize > MAX_ORGANIZATION_AVATAR_SIZE
      ) {
        setErrorMessage(
          'Choose an organization photo smaller than 5 MB.'
        );

        return;
      }

      setSelectedAsset(asset);
      setRemoveAvatar(false);
    } catch (error) {
      console.warn(
        '[organization-edit-profile] Could not open image picker.',
        error
      );

      setErrorMessage(
        'We could not open your photo library. Please try again.'
      );
    } finally {
      pickingRef.current = false;
      setIsPicking(false);
    }
  };

  const handleRemoveAvatar = () => {
    setSelectedAsset(null);
    setRemoveAvatar(true);
    setErrorMessage(null);
  };

  const handleSave = async () => {
    if (
      !organization ||
      !userId ||
      savePendingRef.current
    ) {
      return;
    }

    savePendingRef.current = true;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const result = await updateOrganizationProfile({
        asset: selectedAsset,
        currentAvatarPath: organization.avatarPath,
        description,
        name,
        organizationId: organization.id,
        removeAvatar,
        role: organization.role,
      });

      if (result.avatarCleanupFailed) {
        Alert.alert(
          'Organization saved',
          'The organization profile was updated, but the previous image could not be cleaned up automatically.'
        );
      }

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace({
          pathname: '/organization/[id]',
          params: { id: organization.id },
        });
      }
    } catch (error) {
      console.warn(
        '[organization-edit-profile] Could not update organization.',
        error
      );

      setErrorMessage(
        getOrganizationUpdateErrorMessage(error)
      );

      savePendingRef.current = false;
      setIsSaving(false);
    }
  };

  const displayedAvatarUrl =
    selectedAsset?.uri ??
    (removeAvatar
      ? null
      : organization?.avatarUrl ?? null);

  if (isLoading) {
    return (
      <SafeAreaScreen style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            color={colors.textSecondary}
          />
        </View>
      </SafeAreaScreen>
    );
  }

  if (!organization) {
    return (
      <SafeAreaScreen style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={12}
            onPress={goBack}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.pressed,
            ]}
          >
            <SymbolView
              name={{
                android: 'arrow_back',
                ios: 'chevron.left',
                web: 'arrow_back',
              }}
              size={22}
              tintColor={colors.textPrimary}
            />
          </Pressable>

          <Text style={styles.headerTitle}>
            Edit organization
          </Text>

          <View style={styles.headerButton} />
        </View>

        <View style={styles.unavailableContainer}>
          <Text style={styles.unavailableTitle}>
            Editing unavailable
          </Text>

          <Text style={styles.unavailableMessage}>
            Only organization owners and admins can edit this
            profile.
          </Text>
        </View>
      </SafeAreaScreen>
    );
  }

  return (
    <SafeAreaScreen style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            disabled={isSaving}
            hitSlop={12}
            onPress={goBack}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.pressed,
            ]}
          >
            <SymbolView
              name={{
                android: 'arrow_back',
                ios: 'chevron.left',
                web: 'arrow_back',
              }}
              size={22}
              tintColor={colors.textPrimary}
            />
          </Pressable>

          <Text style={styles.headerTitle}>
            Edit organization
          </Text>

          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <Text style={styles.eyebrow}>
              ORGANIZATION IDENTITY
            </Text>

            <Text style={styles.title}>
              Keep it recognizable.
            </Text>

            <Text style={styles.subtitle}>
              Update how your organization appears across
              Varta.
            </Text>
          </View>

          <View style={styles.avatarSection}>
            <Avatar
              fullName={name || organization.name}
              size={104}
              uri={displayedAvatarUrl}
              verified={organization.isVerified}
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
                  {isPicking
                    ? 'Opening photos…'
                    : 'Choose photo'}
                </Text>
              </Pressable>

              {(organization.avatarPath ||
                selectedAsset) &&
              !removeAvatar ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={handleRemoveAvatar}
                  style={({ pressed }) =>
                    pressed && styles.pressed
                  }
                >
                  <Text style={styles.removePhotoText}>
                    Remove
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.formCard}>
            <AuthField
              autoCapitalize="words"
              label="Organization name"
              onChangeText={setName}
              placeholder="Organization name"
              value={name}
            />

            <View style={styles.fieldGroup}>
              <View style={styles.descriptionHeader}>
                <Text style={styles.fieldLabel}>
                  Description
                </Text>

                <Text style={styles.characterCount}>
                  {description.length}/
                  {MAX_ORGANIZATION_DESCRIPTION_CHARACTERS}
                </Text>
              </View>

              <TextInput
                maxLength={
                  MAX_ORGANIZATION_DESCRIPTION_CHARACTERS
                }
                multiline
                onChangeText={setDescription}
                placeholder="Tell students what this organization does."
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.textPrimary}
                style={styles.descriptionInput}
                textAlignVertical="top"
                value={description}
              />
            </View>

            <View style={styles.lockedSection}>
              <Text style={styles.fieldLabel}>
                Campus
              </Text>

              <View style={styles.lockedField}>
                <Text
                  numberOfLines={2}
                  style={styles.lockedFieldText}
                >
                  {organization.campusShortName}
                </Text>

                <SymbolView
                  name={{
                    android: 'lock',
                    ios: 'lock.fill',
                    web: 'lock',
                  }}
                  size={15}
                  tintColor={colors.textMuted}
                />
              </View>

              <Text style={styles.helperText}>
                Campus association cannot be changed from
                organization settings.
              </Text>
            </View>

            <View style={styles.lockedSection}>
              <Text style={styles.fieldLabel}>
                Profile address
              </Text>

              <View style={styles.lockedField}>
                <Text
                  numberOfLines={1}
                  style={styles.lockedFieldText}
                >
                  @{organization.slug}
                </Text>

                <SymbolView
                  name={{
                    android: 'lock',
                    ios: 'lock.fill',
                    web: 'lock',
                  }}
                  size={15}
                  tintColor={colors.textMuted}
                />
              </View>
            </View>
          </View>

          {errorMessage ? (
            <Text
              accessibilityRole="alert"
              style={styles.errorMessage}
            >
              {errorMessage}
            </Text>
          ) : null}

          <PrimaryButton
            isLoading={isSaving}
            label="Save organization"
            onPress={handleSave}
          />

          <Text style={styles.note}>
            Only owners and admins can change organization
            identity details.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaScreen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },

    keyboardView: {
      flex: 1,
    },

    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
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
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingBottom: 160,
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

    descriptionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    characterCount: {
      fontSize: 11,
      color: colors.textMuted,
    },

    descriptionInput: {
      minHeight: 120,
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

    lockedSection: {
      gap: spacing.sm,
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
      fontSize: 11,
      lineHeight: 17,
      color: colors.textMuted,
    },

    unavailableContainer: {
      flex: 1,
      padding: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },

    unavailableTitle: {
      fontSize: 20,
      fontWeight: '700',
      textAlign: 'center',
      color: colors.textPrimary,
    },

    unavailableMessage: {
      maxWidth: 290,
      marginTop: spacing.sm,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      color: colors.textSecondary,
    },

    pressed: {
      opacity: 0.58,
    },
  });
