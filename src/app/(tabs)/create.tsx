import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, radius, spacing } from '../../constants/theme';

const MAX_CHARACTERS = 500;

export default function CreateScreen() {
  const [content, setContent] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  const remainingCharacters = MAX_CHARACTERS - content.length;

  const canPublish =
    content.trim().length > 0 || imageUri !== null;

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const removeImage = () => {
    setImageUri(null);
  };

  const handlePublish = () => {
    if (!canPublish) {
      return;
    }

    console.log({
      content: content.trim(),
      imageUri,
    });

    setContent('');
    setImageUri(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.title}>New post</Text>

          <Pressable
            onPress={handlePublish}
            disabled={!canPublish}
            style={({ pressed }) => [
              styles.publishButton,
              !canPublish && styles.publishButtonDisabled,
              pressed && canPublish && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.publishText,
                !canPublish && styles.publishTextDisabled,
              ]}
            >
              Publish
            </Text>
          </Pressable>
        </View>

        <View style={styles.authorRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>P</Text>
          </View>

          <View>
            <Text style={styles.authorName}>Pranav</Text>
            <Text style={styles.authorMeta}>CSE · 4th Year</Text>
          </View>
        </View>

        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="What's happening on campus?"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={MAX_CHARACTERS}
          style={styles.input}
          textAlignVertical="top"
        />

        {imageUri && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: imageUri }}
              style={styles.imagePreview}
            />

            <Pressable
              onPress={removeImage}
              style={({ pressed }) => [
                styles.removeImageButton,
                pressed && styles.pressed,
              ]}
            >
              <SymbolView
                name={{
                  ios: 'xmark',
                  android: 'close',
                  web: 'close',
                }}
                size={18}
                tintColor={colors.white}
              />
            </Pressable>
          </View>
        )}

        <View style={styles.footer}>
          <Pressable
            onPress={pickImage}
            style={({ pressed }) => [
              styles.mediaButton,
              pressed && styles.pressed,
            ]}
          >
            <SymbolView
              name={{
                ios: 'photo',
                android: 'image',
                web: 'image',
              }}
              size={21}
              tintColor={colors.textPrimary}
            />

            <Text style={styles.mediaButtonText}>
              Add photo
            </Text>
          </Pressable>

          <Text
            style={[
              styles.characterCount,
              remainingCharacters < 50 &&
                styles.characterCountWarning,
            ]}
          >
            {remainingCharacters}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  publishButton: {
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.full,
  },

  publishButtonDisabled: {
    backgroundColor: colors.border,
  },

  publishText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },

  publishTextDisabled: {
    color: colors.textMuted,
  },

  authorRow: {
    marginTop: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: spacing.md,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },

  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  authorMeta: {
    marginTop: 3,
    fontSize: 12,
    color: colors.textSecondary,
  },

  input: {
    minHeight: 180,
    marginTop: spacing.xl,
    padding: 0,
    fontSize: 20,
    lineHeight: 29,
    color: colors.textPrimary,
  },

  imageContainer: {
    position: 'relative',
    marginTop: spacing.lg,
  },

  imagePreview: {
    width: '100%',
    height: 280,
    borderRadius: radius.lg,
  },

  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  footer: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  mediaButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  mediaButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },

  characterCount: {
    fontSize: 12,
    color: colors.textMuted,
  },

  characterCountWarning: {
    color: colors.textSecondary,
    fontWeight: '600',
  },

  pressed: {
    opacity: 0.55,
  },
});