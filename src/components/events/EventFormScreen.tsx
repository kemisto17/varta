import { Image } from 'expo-image';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { useThemedStyles } from '../../hooks/useTheme';

import { radius, spacing, type ThemeColors } from '../../constants/theme';
import { getEventErrorMessage, MAX_EVENT_COVER_SIZE } from '../../lib/events';
import { requestImageLibraryAccess } from '../../lib/imagePicker';
import type { CampusEvent, EventFormValues } from '../../types/event';
import { SafeAreaScreen } from '../SafeAreaScreen';
import { ScreenHeader } from '../ScreenHeader';
import { EventDateTimeField } from './EventDateTimeField';

type EventFormScreenProps = {
  initialEvent?: CampusEvent;
  onSubmit: (values: EventFormValues) => Promise<void>;
  organizationName: string;
  submitLabel: string;
  title: string;
};

export function EventFormScreen({
  initialEvent,
  onSubmit,
  organizationName,
  submitLabel,
  title,
}: EventFormScreenProps) {
  const { colors, styles } = useThemedStyles(createStyles);
  const defaultStart = initialEvent ? new Date(initialEvent.startsAt) : getDefaultStart();
  const [coverAsset, setCoverAsset] = useState<ImagePickerAsset | null>(null);
  const [description, setDescription] = useState(initialEvent?.description ?? '');
  const [endsAt, setEndsAt] = useState<Date | null>(
    initialEvent?.endsAt ? new Date(initialEvent.endsAt) : null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState(initialEvent?.location ?? '');
  const [registrationUrl, setRegistrationUrl] = useState(initialEvent?.registrationUrl ?? '');
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [eventTitle, setEventTitle] = useState(initialEvent?.title ?? '');

  const pickCover = async () => {
    if (isPicking || isSubmitting) {
      return;
    }

    setIsPicking(true);
    setErrorMessage(null);

    try {
      if (!(await requestImageLibraryAccess())) {
        setErrorMessage('Allow photo access to add an event cover.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        allowsMultipleSelection: false,
        aspect: [16, 9],
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];

      if (asset.fileSize && asset.fileSize > MAX_EVENT_COVER_SIZE) {
        setErrorMessage('Choose an image smaller than 8 MB.');
        return;
      }

      setCoverAsset(asset);
    } catch {
      setErrorMessage('We could not open your photo library. Please try again.');
    } finally {
      setIsPicking(false);
    }
  };

  const submit = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onSubmit({
        coverAsset,
        description,
        endsAt,
        location,
        registrationUrl,
        startsAt,
        title: eventTitle,
      });
    } catch (error) {
      console.warn('[event-form] Could not save event.', error);
      setErrorMessage(getEventErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const setStartDate = (date: Date) => {
    const next = combineDateAndTime(date, startsAt);
    setStartsAt(next);

    if (endsAt && endsAt <= next) {
      setEndsAt(new Date(next.getTime() + 2 * 60 * 60 * 1000));
    }
  };

  const setStartTime = (date: Date) => {
    const next = combineDateAndTime(startsAt, date);
    setStartsAt(next);

    if (endsAt && endsAt <= next) {
      setEndsAt(new Date(next.getTime() + 2 * 60 * 60 * 1000));
    }
  };

  const toggleEndTime = (enabled: boolean) => {
    setEndsAt(enabled ? new Date(startsAt.getTime() + 2 * 60 * 60 * 1000) : null);
  };

  const coverUri = coverAsset?.uri ?? initialEvent?.coverUrl ?? null;

  return (
    <SafeAreaScreen style={styles.safeArea}>
      <ScreenHeader title={title} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.organization}>{organizationName}</Text>
          <Text style={styles.heading}>{initialEvent ? 'Update the details.' : 'Plan something worth showing up for.'}</Text>

          <Field label="Event title">
            <TextInput
              editable={!isSubmitting}
              maxLength={120}
              onChangeText={setEventTitle}
              placeholder="Hackathon kickoff"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={eventTitle}
            />
          </Field>

          <Field label="Description">
            <TextInput
              editable={!isSubmitting}
              maxLength={5000}
              multiline
              onChangeText={setDescription}
              placeholder="What should students know?"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.multiline]}
              textAlignVertical="top"
              value={description}
            />
          </Field>

          <View style={styles.dateRow}>
            <EventDateTimeField label="Date" mode="date" onChange={setStartDate} value={startsAt} />
            <EventDateTimeField label="Starts" mode="time" onChange={setStartTime} value={startsAt} />
          </View>

          <View style={styles.endHeader}>
            <Text style={styles.fieldLabel}>Add end time</Text>
            <Switch
              onValueChange={toggleEndTime}
              trackColor={{ false: colors.border, true: colors.textPrimary }}
              thumbColor={colors.white}
              value={endsAt !== null}
            />
          </View>
          {endsAt ? (
            <View style={styles.dateRow}>
              <EventDateTimeField
                label="End date"
                mode="date"
                onChange={(date) => setEndsAt(combineDateAndTime(date, endsAt))}
                value={endsAt}
              />
              <EventDateTimeField
                label="Ends"
                mode="time"
                onChange={(date) => setEndsAt(combineDateAndTime(endsAt, date))}
                value={endsAt}
              />
            </View>
          ) : null}

          <Field label="Location">
            <TextInput
              editable={!isSubmitting}
              maxLength={160}
              onChangeText={setLocation}
              placeholder="Auditorium"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={location}
            />
          </Field>

          <Field label="Registration link · optional">
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
              keyboardType="url"
              maxLength={500}
              onChangeText={setRegistrationUrl}
              placeholder="https://..."
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={registrationUrl}
            />
          </Field>

          <Field label="Cover image · optional">
            {coverUri ? (
              <Image contentFit="cover" source={{ uri: coverUri }} style={styles.cover} />
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={isPicking || isSubmitting}
              onPress={() => void pickCover()}
              style={({ pressed }) => [styles.coverButton, pressed && styles.pressed]}
            >
              {isPicking ? (
                <ActivityIndicator color={colors.textPrimary} size="small" />
              ) : (
                <SymbolView name={{ android: 'image', ios: 'photo', web: 'image' }} size={19} tintColor={colors.textPrimary} />
              )}
              <Text style={styles.coverButtonText}>{coverUri ? 'Change cover' : 'Choose cover'}</Text>
            </Pressable>
            <Text style={styles.hint}>JPG, PNG, WebP, HEIC, or HEIF · up to 8 MB</Text>
          </Field>

          {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => void submit()}
            style={({ pressed }) => [styles.submit, pressed && styles.pressed, isSubmitting && styles.disabled]}
          >
            {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>{submitLabel}</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaScreen>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function getDefaultStart() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return date;
}

function combineDateAndTime(datePart: Date, timePart: Date) {
  return new Date(
    datePart.getFullYear(),
    datePart.getMonth(),
    datePart.getDate(),
    timePart.getHours(),
    timePart.getMinutes(),
    0,
    0
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboard: { flex: 1 },
  content: { flexGrow: 1,padding: spacing.lg, paddingBottom: 160 },
  organization: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.textMuted },
  heading: { maxWidth: 330, marginTop: spacing.sm, marginBottom: spacing.xl, fontSize: 25, lineHeight: 32, fontWeight: '700', color: colors.textPrimary },
  field: { marginTop: spacing.lg },
  fieldLabel: { marginBottom: spacing.sm, fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  input: { minHeight: 52, paddingHorizontal: spacing.md, paddingVertical: 13, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, fontSize: 15, color: colors.textPrimary },
  multiline: { minHeight: 128, lineHeight: 22 },
  dateRow: { marginTop: spacing.lg, flexDirection: 'row', gap: spacing.md },
  endHeader: { marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cover: { width: '100%', aspectRatio: 16 / 9, marginBottom: spacing.sm, borderRadius: radius.md, backgroundColor: colors.borderSubtle },
  coverButton: { minHeight: 50, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  coverButtonText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  hint: { marginTop: spacing.xs, fontSize: 11, color: colors.textMuted },
  error: { marginTop: spacing.lg, fontSize: 13, lineHeight: 19, color: colors.danger },
  submit: { minHeight: 54, marginTop: spacing.xl, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, backgroundColor: colors.textPrimary },
  submitText: { fontSize: 14, fontWeight: '700', color: colors.white },
  pressed: { opacity: 0.55 },
  disabled: { opacity: 0.45 },
});
