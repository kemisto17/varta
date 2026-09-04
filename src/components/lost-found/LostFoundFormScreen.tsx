import type { ImagePickerAsset } from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { radius, spacing, type ThemeColors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useTheme';
import {
  getLostFoundCategoryLabel,
  getLostFoundErrorMessage,
  MAX_LOST_FOUND_DESCRIPTION_CHARACTERS,
  MAX_LOST_FOUND_LOCATION_CHARACTERS,
  MAX_LOST_FOUND_TITLE_CHARACTERS,
} from '../../lib/lostFound';
import {
  LOST_FOUND_CATEGORIES,
  type LostFoundDraft,
  type LostFoundItem,
  type LostFoundKind,
} from '../../types/lostFound';
import { SafeAreaScreen } from '../SafeAreaScreen';
import {
  CreateTypeSelector,
  type CreateContentType,
} from '../CreateTypeSelector';
import { ScreenHeader } from '../ScreenHeader';
import { EventDateTimeField } from '../events/EventDateTimeField';
import { ActionSheet } from '../moderation/ActionSheet';
import { PostImageField } from '../posts/PostImageField';

export type LostFoundFormSubmission = {
  asset: ImagePickerAsset | null;
  draft: LostFoundDraft;
  removeImage: boolean;
};

type LostFoundFormScreenProps = {
  createTypeChangeDisabled?: boolean;
  initialItem?: LostFoundItem | null;
  kind: LostFoundKind;
  onCreateTypeChange?: (type: CreateContentType) => void;
  onSubmit: (submission: LostFoundFormSubmission) => Promise<void>;
  submitLabel: string;
  title: string;
  withinTabNavigator?: boolean;
};

export function LostFoundFormScreen({
  createTypeChangeDisabled = false,
  initialItem = null,
  kind,
  onCreateTypeChange,
  onSubmit,
  submitLabel,
  title,
  withinTabNavigator = false,
}: LostFoundFormScreenProps) {
  const { colors, styles } = useThemedStyles(createStyles);
  const submitPendingRef = useRef(false);
  const [itemTitle, setItemTitle] = useState(initialItem?.title ?? '');
  const [description, setDescription] = useState(
    initialItem?.description ?? ''
  );
  const [category, setCategory] = useState(
    initialItem?.category ?? 'other'
  );
  const [campusLocation, setCampusLocation] = useState(
    initialItem?.campusLocation ?? ''
  );
  const [itemDate, setItemDate] = useState(() =>
    initialItem ? parseDate(initialItem.itemDate) : new Date()
  );
  const [imageAsset, setImageAsset] = useState<ImagePickerAsset | null>(null);
  const [isExistingImageRemoved, setIsExistingImageRemoved] = useState(false);
  const [isCategoryPickerVisible, setIsCategoryPickerVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setItemTitle(initialItem?.title ?? '');
    setDescription(initialItem?.description ?? '');
    setCategory(initialItem?.category ?? 'other');
    setCampusLocation(initialItem?.campusLocation ?? '');
    setItemDate(initialItem ? parseDate(initialItem.itemDate) : new Date());
    setImageAsset(null);
    setIsExistingImageRemoved(false);
    setErrorMessage(null);
  }, [initialItem]);

  const canSubmit =
    itemTitle.trim().length > 0 &&
    description.trim().length > 0 &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit || submitPendingRef.current) {
      return;
    }

    submitPendingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onSubmit({
        asset: imageAsset,
        draft: {
          campusLocation,
          category,
          description,
          itemDate: formatDate(itemDate),
          kind,
          title: itemTitle,
        },
        removeImage: isExistingImageRemoved,
      });
    } catch (error) {
      console.warn('[lost-found-form] Could not save listing.', error);
      setErrorMessage(getLostFoundErrorMessage(error));
    } finally {
      submitPendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const headerAction = (
    <Pressable
      accessibilityRole="button"
      disabled={!canSubmit}
      onPress={() => void handleSubmit()}
      style={({ pressed }) => [
        styles.submitButton,
        !canSubmit && styles.submitButtonDisabled,
        pressed && canSubmit && styles.pressed,
      ]}
    >
      {isSubmitting ? (
        <ActivityIndicator color={colors.white} size="small" />
      ) : (
        <Text
          style={[
            styles.submitText,
            !canSubmit && styles.submitTextDisabled,
          ]}
        >
          {submitLabel}
        </Text>
      )}
    </Pressable>
  );

  return (
    <SafeAreaScreen
      style={styles.screen}
      withinTabNavigator={withinTabNavigator}
    >
      <ScreenHeader
        action={headerAction}
        showBackButton={!withinTabNavigator}
        title={withinTabNavigator ? 'Create' : title}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            withinTabNavigator && styles.tabContent,
          ]}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {onCreateTypeChange ? (
            <CreateTypeSelector
              disabled={isSubmitting || createTypeChangeDisabled}
              onChange={onCreateTypeChange}
              value={kind}
            />
          ) : null}

          <View style={styles.moduleNotice}>
            <Text style={styles.moduleEyebrow}>VARTA LOST & FOUND</Text>
            <Text style={styles.moduleTitle}>
              {kind === 'lost' ? 'Report a lost item' : 'Report a found item'}
            </Text>
            <Text style={styles.moduleMessage}>
              Add useful campus details without sharing private or precise location
              information.
            </Text>
          </View>

          <Text style={styles.label}>Item title</Text>
          <TextInput
            editable={!isSubmitting}
            maxLength={MAX_LOST_FOUND_TITLE_CHARACTERS}
            onChangeText={setItemTitle}
            placeholder={kind === 'lost' ? 'e.g. Black water bottle' : 'e.g. Student ID card'}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={itemTitle}
          />
          <Text style={styles.counter}>
            {itemTitle.length}/{MAX_LOST_FOUND_TITLE_CHARACTERS}
          </Text>

          <Text style={styles.label}>Category</Text>
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => setIsCategoryPickerVisible(true)}
            style={({ pressed }) => [
              styles.selectControl,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.selectValue}>
              {getLostFoundCategoryLabel(category)}
            </Text>
            <SymbolView
              name={{ android: 'expand_more', ios: 'chevron.down', web: 'expand_more' }}
              size={17}
              tintColor={colors.textSecondary}
            />
          </Pressable>

          <Text style={styles.label}>Description</Text>
          <TextInput
            editable={!isSubmitting}
            maxLength={MAX_LOST_FOUND_DESCRIPTION_CHARACTERS}
            multiline
            onChangeText={setDescription}
            placeholder={
              kind === 'lost'
                ? 'When and where did you last see it? Add identifying details.'
                : 'Where did you find it? Avoid details only the owner should know.'
            }
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.descriptionInput]}
            textAlignVertical="top"
            value={description}
          />
          <Text style={styles.counter}>
            {description.length}/{MAX_LOST_FOUND_DESCRIPTION_CHARACTERS}
          </Text>

          <Text style={styles.label}>Approximate campus location (optional)</Text>
          <TextInput
            editable={!isSubmitting}
            maxLength={MAX_LOST_FOUND_LOCATION_CHARACTERS}
            onChangeText={setCampusLocation}
            placeholder="e.g. Main library, second floor"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={campusLocation}
          />
          <Text style={styles.locationHint}>
            This is typed campus context only. Varta does not request device GPS.
          </Text>

          <View style={styles.dateField}>
            <EventDateTimeField
              label={kind === 'lost' ? 'Date lost' : 'Date found'}
              maximumDate={new Date()}
              mode="date"
              onChange={setItemDate}
              value={itemDate}
            />
          </View>

          <PostImageField
            asset={imageAsset}
            disabled={isSubmitting}
            existingImageUrl={
              isExistingImageRemoved ? null : initialItem?.imageUrl ?? null
            }
            onChange={(asset) => {
              setImageAsset(asset);
              setIsExistingImageRemoved(asset === null);
            }}
            onError={setErrorMessage}
          />

          {errorMessage ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {errorMessage}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <ActionSheet
        actions={LOST_FOUND_CATEGORIES.map((option) => ({
          label: option.label,
          onPress: () => setCategory(option.value),
        }))}
        onClose={() => setIsCategoryPickerVisible(false)}
        title="Choose category"
        visible={isCategoryPickerVisible}
      />
    </SafeAreaScreen>
  );
}

function parseDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    keyboardView: { flex: 1 },
    content: { padding: spacing.lg, paddingBottom: 120 },
    tabContent: { paddingTop: 0 },
    moduleNotice: {
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
    },
    moduleEyebrow: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.15,
      color: colors.textMuted,
    },
    moduleTitle: {
      marginTop: spacing.xs,
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    moduleMessage: {
      marginTop: spacing.sm,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
    },
    label: {
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    input: {
      minHeight: 50,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      fontSize: 15,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    descriptionInput: { minHeight: 128, lineHeight: 22 },
    counter: {
      marginTop: spacing.xs,
      textAlign: 'right',
      fontSize: 11,
      color: colors.textMuted,
    },
    selectControl: {
      minHeight: 50,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
    },
    selectValue: { fontSize: 15, color: colors.textPrimary },
    locationHint: {
      marginTop: spacing.sm,
      fontSize: 11,
      lineHeight: 16,
      color: colors.textMuted,
    },
    dateField: { marginTop: spacing.lg },
    submitButton: {
      minWidth: 84,
      minHeight: 40,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.full,
      backgroundColor: colors.textPrimary,
    },
    submitButtonDisabled: { backgroundColor: colors.border },
    submitText: { fontSize: 13, fontWeight: '700', color: colors.white },
    submitTextDisabled: { color: colors.textMuted },
    errorText: {
      marginTop: spacing.md,
      fontSize: 13,
      lineHeight: 19,
      color: colors.danger,
    },
    pressed: { opacity: 0.55 },
  });
