import { useThemedStyles } from '../hooks/useTheme';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type ThemeColors } from '../constants/theme';
import { getInitials } from '../lib/text';

type AvatarProps = {
  fullName: string;
  size?: number;
  uri?: string | null;
  verified?: boolean;
};

export function Avatar({
  fullName,
  size = 42,
  uri = null,
  verified = false,
}: AvatarProps) {
  const { styles } = useThemedStyles(createStyles);
  const [imageFailed, setImageFailed] = useState(false);
  const borderWidth = verified ? 2 : 0;
  const innerSize = size - borderWidth * 2;

  useEffect(() => {
    setImageFailed(false);
  }, [uri]);

  return (
    <View
      accessibilityLabel={`${fullName}${verified ? ', verified student' : ''}`}
      style={[
        styles.frame,
        {
          borderRadius: size / 2,
          borderWidth,
          height: size,
          width: size,
        },
        verified && styles.verifiedFrame,
      ]}
    >
      {uri && !imageFailed ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          onError={() => setImageFailed(true)}
          recyclingKey={uri}
          source={{ uri }}
          style={{
            borderRadius: innerSize / 2,
            height: innerSize,
            width: innerSize,
          }}
          transition={140}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            {
              borderRadius: innerSize / 2,
              height: innerSize,
              width: innerSize,
            },
          ]}
        >
          <Text
            maxFontSizeMultiplier={1.2}
            style={[styles.initials, { fontSize: Math.max(10, size * 0.3) }]}
          >
            {getInitials(fullName || 'Student')}
          </Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  verifiedFrame: {
    borderColor: colors.textPrimary,
  },

  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textPrimary,
  },

  initials: {
    fontWeight: '700',
    letterSpacing: 0.3,
    color: colors.white,
  },
});
