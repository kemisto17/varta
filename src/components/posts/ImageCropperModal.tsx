import {
  ImageManipulator,
  SaveFormat,
} from 'expo-image-manipulator';
import { Image } from 'expo-image';
import type { ImagePickerAsset } from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
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
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing } from '../../constants/theme';

type CropAspect = 'original' | 'square' | 'portrait' | 'wide';

type ImageCropperModalProps = {
  asset: ImagePickerAsset | null;
  onCancel: () => void;
  onCropped: (asset: ImagePickerAsset) => void;
};

const ASPECT_OPTIONS: readonly {
  label: string;
  value: CropAspect;
}[] = [
  { label: 'Original', value: 'original' },
  { label: '1:1', value: 'square' },
  { label: '4:5', value: 'portrait' },
  { label: '16:9', value: 'wide' },
];

const MAX_SCALE = 4;

export function ImageCropperModal({
  asset,
  onCancel,
  onCropped,
}: ImageCropperModalProps) {
  const { height: viewportHeight, width: viewportWidth } =
    useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [aspect, setAspect] = useState<CropAspect>('original');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [naturalSize, setNaturalSize] = useState({
    height: asset?.height ?? 0,
    width: asset?.width ?? 0,
  });

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const pinchStartX = useSharedValue(0);
  const pinchStartY = useSharedValue(0);
  const baseImageWidth = useSharedValue(1);
  const baseImageHeight = useSharedValue(1);
  const cropFrameWidth = useSharedValue(1);
  const cropFrameHeight = useSharedValue(1);

  const imageRatio =
    naturalSize.width > 0 && naturalSize.height > 0
      ? naturalSize.width / naturalSize.height
      : 1;

  const cropRatio = getCropRatio(aspect, imageRatio);

  const frameSize = useMemo(
    () =>
      getContainedSize(
        cropRatio,
        Math.max(1, viewportWidth - spacing.lg * 2),
        Math.max(
          1,
          Math.min(
            viewportHeight * 0.62,
            viewportHeight - insets.top - insets.bottom - 190
          )
        )
      ),
    [cropRatio, insets.bottom, insets.top, viewportHeight, viewportWidth]
  );

  const coveredImageSize = useMemo(
    () =>
      getCoveredSize(
        naturalSize.width,
        naturalSize.height,
        frameSize.width,
        frameSize.height
      ),
    [frameSize.height, frameSize.width, naturalSize.height, naturalSize.width]
  );

  const resetTransform = useCallback(() => {
    cancelAnimation(scale);
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
  }, [scale, translateX, translateY]);

  useEffect(() => {
    if (!asset) {
      return;
    }

    setAspect('original');
    setErrorMessage(null);
    setIsApplying(false);
    setNaturalSize({
      height: asset.height ?? 0,
      width: asset.width ?? 0,
    });
    resetTransform();
  }, [asset, resetTransform]);

  useEffect(() => {
    baseImageHeight.value = coveredImageSize.height;
    baseImageWidth.value = coveredImageSize.width;
    cropFrameHeight.value = frameSize.height;
    cropFrameWidth.value = frameSize.width;
    resetTransform();
  }, [
    aspect,
    baseImageHeight,
    baseImageWidth,
    coveredImageSize.height,
    coveredImageSize.width,
    cropFrameHeight,
    cropFrameWidth,
    frameSize.height,
    frameSize.width,
    resetTransform,
  ]);

  const panGesture = Gesture.Pan()
    .averageTouches(true)
    .maxPointers(1)
    .minDistance(3)
    .onBegin(() => {
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      const bounds = getPanBounds(
        scale.value,
        baseImageWidth.value,
        baseImageHeight.value,
        cropFrameWidth.value,
        cropFrameHeight.value
      );

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
    });

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      pinchStartScale.value = scale.value;
      pinchStartX.value = translateX.value;
      pinchStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      const nextScale = clampWorklet(
        pinchStartScale.value * event.scale,
        1,
        MAX_SCALE
      );
      const scaleRatio = nextScale / pinchStartScale.value;
      const focalX = event.focalX - cropFrameWidth.value / 2;
      const focalY = event.focalY - cropFrameHeight.value / 2;
      const bounds = getPanBounds(
        nextScale,
        baseImageWidth.value,
        baseImageHeight.value,
        cropFrameWidth.value,
        cropFrameHeight.value
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
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const imageTransformStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const applyCrop = async () => {
    if (
      !asset ||
      naturalSize.width <= 0 ||
      naturalSize.height <= 0 ||
      isApplying
    ) {
      return;
    }

    setIsApplying(true);
    setErrorMessage(null);

    try {
      const sourceScale =
        (coveredImageSize.width / naturalSize.width) * scale.value;
      const cropWidth = clamp(
        Math.round(frameSize.width / sourceScale),
        1,
        naturalSize.width
      );
      const cropHeight = clamp(
        Math.round(frameSize.height / sourceScale),
        1,
        naturalSize.height
      );
      const originX = clamp(
        Math.round(
          naturalSize.width / 2 -
            translateX.value / sourceScale -
            cropWidth / 2
        ),
        0,
        naturalSize.width - cropWidth
      );
      const originY = clamp(
        Math.round(
          naturalSize.height / 2 -
            translateY.value / sourceScale -
            cropHeight / 2
        ),
        0,
        naturalSize.height - cropHeight
      );

      const isUnchanged =
        originX === 0 &&
        originY === 0 &&
        cropWidth === naturalSize.width &&
        cropHeight === naturalSize.height;

      if (isUnchanged) {
        onCropped(asset);
        return;
      }

      const manipulator = ImageManipulator.manipulate(asset.uri);
      manipulator.crop({
        height: cropHeight,
        originX,
        originY,
        width: cropWidth,
      });

      const rendered = await manipulator.renderAsync();
      const result = await rendered.saveAsync({
        compress: 0.95,
        format: SaveFormat.JPEG,
      });

      onCropped({
        ...asset,
        file: undefined,
        fileName: `cropped-${Date.now()}.jpg`,
        fileSize: undefined,
        height: result.height,
        mimeType: 'image/jpeg',
        uri: result.uri,
        width: result.width,
      });
    } catch (error) {
      console.warn('[image-cropper] Could not crop image.', error);
      setErrorMessage('We could not crop this photo. Try another image.');
    } finally {
      setIsApplying(false);
    }
  };

  if (!asset) {
    return null;
  }

  return (
    <Modal
      animationType="slide"
      hardwareAccelerated
      navigationBarTranslucent
      onRequestClose={isApplying ? () => undefined : onCancel}
      presentationStyle="fullScreen"
      statusBarTranslucent
      visible
    >
      <StatusBar style="light" />

      <GestureHandlerRootView style={styles.root}>
        <View
          style={[
            styles.header,
            {
              paddingLeft: spacing.lg + insets.left,
              paddingRight: spacing.lg + insets.right,
              paddingTop: Math.max(insets.top, spacing.md),
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            disabled={isApplying}
            onPress={onCancel}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>

          <Text style={styles.title}>Crop photo</Text>

          <Pressable
            accessibilityRole="button"
            disabled={isApplying}
            onPress={() => void applyCrop()}
            style={({ pressed }) => pressed && styles.pressed}
          >
            {isApplying ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.doneText}>Done</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.stage}>
          <View
            style={[
              styles.cropFrame,
              {
                height: frameSize.height,
                width: frameSize.width,
              },
            ]}
          >
            <GestureDetector gesture={composedGesture}>
              <Animated.View style={styles.gestureSurface}>
                <Animated.View
                  style={[
                    {
                      height: coveredImageSize.height,
                      width: coveredImageSize.width,
                    },
                    imageTransformStyle,
                  ]}
                >
                  <Image
                    accessibilityLabel="Photo being cropped"
                    contentFit="fill"
                    onLoad={(event) => {
                      if (event.source.width > 0 && event.source.height > 0) {
                        setNaturalSize({
                          height: event.source.height,
                          width: event.source.width,
                        });
                      }
                    }}
                    source={{ uri: asset.uri }}
                    style={styles.image}
                  />
                </Animated.View>
              </Animated.View>
            </GestureDetector>

            <View pointerEvents="none" style={styles.grid}>
              <View style={[styles.gridLineVertical, { left: '33.333%' }]} />
              <View style={[styles.gridLineVertical, { left: '66.666%' }]} />
              <View style={[styles.gridLineHorizontal, { top: '33.333%' }]} />
              <View style={[styles.gridLineHorizontal, { top: '66.666%' }]} />
            </View>
          </View>
        </View>

        <View
          style={[
            styles.controls,
            {
              paddingBottom: Math.max(insets.bottom, spacing.lg),
              paddingLeft: spacing.lg + insets.left,
              paddingRight: spacing.lg + insets.right,
            },
          ]}
        >
          <Text style={styles.hint}>Pinch to zoom · drag to reposition</Text>

          <View style={styles.aspectRow}>
            {ASPECT_OPTIONS.map((option) => {
              const isSelected = aspect === option.value;

              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  disabled={isApplying}
                  key={option.value}
                  onPress={() => setAspect(option.value)}
                  style={({ pressed }) => [
                    styles.aspectButton,
                    isSelected && styles.aspectButtonSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.aspectText,
                      isSelected && styles.aspectTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {errorMessage ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {errorMessage}
            </Text>
          ) : null}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function getCropRatio(aspect: CropAspect, originalRatio: number) {
  if (aspect === 'square') {
    return 1;
  }

  if (aspect === 'portrait') {
    return 4 / 5;
  }

  if (aspect === 'wide') {
    return 16 / 9;
  }

  return originalRatio;
}

function getContainedSize(ratio: number, maxWidth: number, maxHeight: number) {
  if (maxWidth / maxHeight > ratio) {
    return { height: maxHeight, width: maxHeight * ratio };
  }

  return { height: maxWidth / ratio, width: maxWidth };
}

function getCoveredSize(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number
) {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return { height: frameHeight, width: frameWidth };
  }

  const coverScale = Math.max(frameWidth / imageWidth, frameHeight / imageHeight);

  return {
    height: imageHeight * coverScale,
    width: imageWidth * coverScale,
  };
}

function getPanBounds(
  scale: number,
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number
) {
  'worklet';

  return {
    x: Math.max(0, (imageWidth * scale - frameWidth) / 2),
    y: Math.max(0, (imageHeight * scale - frameHeight) / 2),
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function clampWorklet(value: number, minimum: number, maximum: number) {
  'worklet';

  return Math.min(Math.max(value, minimum), maximum);
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#090909',
  },
  header: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancelText: {
    minWidth: 56,
    fontSize: 15,
    color: '#D7D7D7',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  doneText: {
    minWidth: 56,
    textAlign: 'right',
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropFrame: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151515',
  },
  gestureSurface: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  grid: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  controls: {
    paddingTop: spacing.lg,
  },
  hint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#A7A7A7',
  },
  aspectRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  aspectButton: {
    minHeight: 38,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3A3A3A',
    borderRadius: radius.full,
  },
  aspectButtonSelected: {
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
  },
  aspectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#C4C4C4',
  },
  aspectTextSelected: {
    color: '#111111',
  },
  errorText: {
    marginTop: spacing.md,
    textAlign: 'center',
    fontSize: 12,
    color: '#FF9E9E',
  },
  pressed: {
    opacity: 0.6,
  },
});
