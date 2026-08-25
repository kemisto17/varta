import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../constants/theme';

export type FullscreenViewerImage = {
  accessibilityLabel?: string;
  uri: string;
};

type FullscreenImageViewerProps = {
  currentIndex?: number;
  images: readonly FullscreenViewerImage[];
  onClose: () => void;
  visible: boolean;
};

type ImageLoadState = 'loading' | 'loaded' | 'error';

const DISMISS_DISTANCE = 120;
const DOUBLE_TAP_SCALE = 2.5;
const MAX_SCALE = 4;

export function FullscreenImageViewer({
  currentIndex = 0,
  images,
  onClose,
  visible,
}: FullscreenImageViewerProps) {
  const { height: viewportHeight, width: viewportWidth } =
    useWindowDimensions();
  const insets = useSafeAreaInsets();
  const safeIndex = clamp(currentIndex, 0, Math.max(0, images.length - 1));
  const currentImage = images[safeIndex] ?? null;
  const [imageLoadState, setImageLoadState] =
    useState<ImageLoadState>('loading');
  const [naturalSize, setNaturalSize] = useState({ height: 0, width: 0 });

  const dismissY = useSharedValue(0);
  const fittedHeight = useSharedValue(viewportHeight);
  const fittedWidth = useSharedValue(viewportWidth);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const pinchStartX = useSharedValue(0);
  const pinchStartY = useSharedValue(0);
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const containedSize = useMemo(
    () =>
      getContainedSize(
        naturalSize.width,
        naturalSize.height,
        viewportWidth,
        viewportHeight
      ),
    [naturalSize.height, naturalSize.width, viewportHeight, viewportWidth]
  );

  const resetTransform = useCallback(() => {
    cancelAnimation(dismissY);
    cancelAnimation(scale);
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    dismissY.value = 0;
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
  }, [dismissY, scale, translateX, translateY]);

  useEffect(() => {
    fittedHeight.value = containedSize.height;
    fittedWidth.value = containedSize.width;
  }, [containedSize.height, containedSize.width, fittedHeight, fittedWidth]);

  useEffect(() => {
    resetTransform();
    setImageLoadState('loading');
    setNaturalSize({ height: 0, width: 0 });
  }, [currentImage?.uri, resetTransform, visible]);

  const dismissFromGesture = useCallback(() => {
    onClose();
  }, [onClose]);

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      pinchStartScale.value = scale.value;
      pinchStartX.value = translateX.value;
      pinchStartY.value = translateY.value;
      dismissY.value = 0;
    })
    .onUpdate((event) => {
      const nextScale = clampWorklet(
        pinchStartScale.value * event.scale,
        1,
        MAX_SCALE
      );
      const scaleRatio = nextScale / pinchStartScale.value;
      const focalX = event.focalX - viewportWidth / 2;
      const focalY = event.focalY - viewportHeight / 2;
      const bounds = getPanBounds(
        nextScale,
        fittedWidth.value,
        fittedHeight.value,
        viewportWidth,
        viewportHeight
      );

      scale.value = nextScale;
      translateX.value = clampWorklet(
        pinchStartX.value * scaleRatio + focalX * (1 - scaleRatio),
        -bounds.x,
        bounds.x
      );
      translateY.value = clampWorklet(
        pinchStartY.value * scaleRatio + focalY * (1 - scaleRatio),
        -bounds.y,
        bounds.y
      );
    })
    .onEnd(() => {
      if (scale.value <= 1.05) {
        scale.value = withSpring(1, getSpringConfig());
        translateX.value = withSpring(0, getSpringConfig());
        translateY.value = withSpring(0, getSpringConfig());
      }
    });

  const panGesture = Gesture.Pan()
    .averageTouches(true)
    .maxPointers(1)
    .minDistance(6)
    .onBegin(() => {
      cancelAnimation(dismissY);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (scale.value > 1.05) {
        const bounds = getPanBounds(
          scale.value,
          fittedWidth.value,
          fittedHeight.value,
          viewportWidth,
          viewportHeight
        );

        dismissY.value = 0;
        translateX.value = clampWorklet(
          panStartX.value + event.translationX,
          -bounds.x,
          bounds.x
        );
        translateY.value = clampWorklet(
          panStartY.value + event.translationY,
          -bounds.y,
          bounds.y
        );
        return;
      }

      translateX.value = 0;
      translateY.value = 0;
      dismissY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (scale.value > 1.05) {
        return;
      }

      const shouldDismiss =
        dismissY.value >= DISMISS_DISTANCE ||
        (dismissY.value > 20 && event.velocityY > 900);

      if (shouldDismiss) {
        dismissY.value = withTiming(
          viewportHeight,
          { duration: 180 },
          (finished) => {
            if (finished) {
              runOnJS(dismissFromGesture)();
            }
          }
        );
        return;
      }

      dismissY.value = withSpring(0, getSpringConfig());
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(250)
    .maxDuration(250)
    .onEnd((event, success) => {
      if (!success) {
        return;
      }

      if (scale.value > 1.05) {
        scale.value = withSpring(1, getSpringConfig());
        translateX.value = withSpring(0, getSpringConfig());
        translateY.value = withSpring(0, getSpringConfig());
        return;
      }

      const focalX = event.x - viewportWidth / 2;
      const focalY = event.y - viewportHeight / 2;
      const bounds = getPanBounds(
        DOUBLE_TAP_SCALE,
        fittedWidth.value,
        fittedHeight.value,
        viewportWidth,
        viewportHeight
      );

      scale.value = withSpring(DOUBLE_TAP_SCALE, getSpringConfig());
      translateX.value = withSpring(
        clampWorklet(
          focalX * (1 - DOUBLE_TAP_SCALE),
          -bounds.x,
          bounds.x
        ),
        getSpringConfig()
      );
      translateY.value = withSpring(
        clampWorklet(
          focalY * (1 - DOUBLE_TAP_SCALE),
          -bounds.y,
          bounds.y
        ),
        getSpringConfig()
      );
    });

  const composedGesture = Gesture.Exclusive(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture)
  );

  const imageTransformStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value + dismissY.value },
      { scale: scale.value },
    ],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      dismissY.value,
      [0, Math.max(1, viewportHeight * 0.65)],
      [1, 0.25],
      Extrapolation.CLAMP
    ),
  }));

  if (!currentImage) {
    return null;
  }

  return (
    <Modal
      animationType="fade"
      hardwareAccelerated
      navigationBarTranslucent
      onRequestClose={onClose}
      onShow={resetTransform}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <StatusBar animated hidden={visible} />

      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />

        <GestureDetector gesture={composedGesture}>
          <Animated.View style={styles.gestureSurface}>
            <Animated.View
              style={[
                styles.imageStage,
                {
                  height: containedSize.height,
                  width: containedSize.width,
                },
                imageTransformStyle,
              ]}
            >
              <Image
                accessibilityLabel={
                  currentImage.accessibilityLabel ?? 'Fullscreen post image'
                }
                cachePolicy="memory-disk"
                contentFit="contain"
                onError={() => setImageLoadState('error')}
                onLoad={(event) => {
                  setNaturalSize({
                    height: event.source.height,
                    width: event.source.width,
                  });
                  setImageLoadState('loaded');
                }}
                onLoadStart={() => setImageLoadState('loading')}
                source={{ uri: currentImage.uri }}
                style={styles.image}
                transition={160}
              />
            </Animated.View>
          </Animated.View>
        </GestureDetector>

        {imageLoadState === 'loading' ? (
          <View pointerEvents="none" style={styles.feedback}>
            <ActivityIndicator color={colors.viewerMuted} />
          </View>
        ) : imageLoadState === 'error' ? (
          <View pointerEvents="none" style={styles.feedback}>
            <Text accessibilityRole="alert" style={styles.errorText}>
              Couldn’t load this image.
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityLabel="Close fullscreen image"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onClose}
          style={({ pressed }) => [
            styles.closeButton,
            { top: Math.max(insets.top, 8) + 8 },
            pressed && styles.closeButtonPressed,
          ]}
        >
          <SymbolView
            name={{ android: 'close', ios: 'xmark', web: 'close' }}
            size={20}
            tintColor={colors.white}
          />
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}

function getContainedSize(
  naturalWidth: number,
  naturalHeight: number,
  viewportWidth: number,
  viewportHeight: number
) {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { height: viewportHeight, width: viewportWidth };
  }

  const imageRatio = naturalWidth / naturalHeight;
  const viewportRatio = viewportWidth / viewportHeight;

  if (imageRatio > viewportRatio) {
    return { height: viewportWidth / imageRatio, width: viewportWidth };
  }

  return { height: viewportHeight, width: viewportHeight * imageRatio };
}

function getPanBounds(
  scale: number,
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number
) {
  'worklet';

  return {
    x: Math.max(0, (imageWidth * scale - viewportWidth) / 2),
    y: Math.max(0, (imageHeight * scale - viewportHeight) / 2),
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function clampWorklet(value: number, minimum: number, maximum: number) {
  'worklet';

  return Math.min(Math.max(value, minimum), maximum);
}

function getSpringConfig() {
  'worklet';

  return {
    damping: 22,
    mass: 0.7,
    stiffness: 220,
  };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.viewerBackground,
  },

  gestureSurface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  imageStage: {
    overflow: 'visible',
  },

  image: {
    width: '100%',
    height: '100%',
  },

  feedback: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorText: {
    paddingHorizontal: 24,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    color: colors.viewerMuted,
  },

  closeButton: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.viewerOverlay,
  },

  closeButtonPressed: {
    opacity: 0.58,
  },
});
