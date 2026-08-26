import { useMemo } from 'react';
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  type TextProps,
} from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { getLinkifiedSegments } from '../../lib/links';

type LinkifiedTextProps = TextProps & {
  children: string;
};

export function LinkifiedText({ children, style, ...props }: LinkifiedTextProps) {
  const { colors } = useTheme();
  const segments = useMemo(() => getLinkifiedSegments(children), [children]);

  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.warn('[links] Could not open external URL.', error);
      Alert.alert(
        'Could not open link',
        'This link is unavailable right now. Check the address and try again.'
      );
    }
  };

  return (
    <Text {...props} style={style}>
      {segments.map((segment, index) =>
        segment.url ? (
          <Text
            accessibilityRole="link"
            key={`${index}:${segment.text}`}
            onPress={(event) => {
              event.stopPropagation();
              void openLink(segment.url!);
            }}
            style={[styles.link, { color: colors.textPrimary }]}
          >
            {segment.text}
          </Text>
        ) : (
          segment.text
        )
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
