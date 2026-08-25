import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../../constants/theme';

export function OrganizationAvatar({
  name,
  size = 48,
  uri = null,
}: {
  name: string;
  size?: number;
  uri?: string | null;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [uri]);

  return (
    <View
      accessibilityLabel={`${name} logo`}
      style={[
        styles.avatar,
        { borderRadius: size >= 72 ? radius.lg : radius.md, height: size, width: size },
      ]}
    >
      {uri && !imageFailed ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          onError={() => setImageFailed(true)}
          recyclingKey={uri}
          source={{ uri }}
          style={{ height: size, width: size }}
          transition={140}
        />
      ) : (
        <Text
          maxFontSizeMultiplier={1.2}
          style={[styles.initial, { fontSize: Math.max(14, size * 0.32) }]}
        >
          {name.slice(0, 1).toUpperCase() || 'V'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textPrimary,
  },
  initial: { fontWeight: '700', color: colors.white },
});
