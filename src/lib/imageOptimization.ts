import {
  ImageManipulator,
  SaveFormat,
} from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';

type OptimizeImageOptions = {
  maxHeight: number;
  maxWidth: number;
  quality?: number;
};

export async function optimizeImageAsset(
  asset: ImagePickerAsset,
  {
    maxHeight,
    maxWidth,
    quality = 0.8,
  }: OptimizeImageOptions
): Promise<ImagePickerAsset> {
  const manipulator = ImageManipulator.manipulate(asset.uri);
  const width = asset.width ?? 0;
  const height = asset.height ?? 0;

  if (width > 0 && height > 0) {
    const scale = Math.min(
      maxWidth / width,
      maxHeight / height,
      1
    );

    if (scale < 1) {
      manipulator.resize({
        height: Math.round(height * scale),
        width: Math.round(width * scale),
      });
    }
  }

  const rendered = await manipulator.renderAsync();
  const result = await rendered.saveAsync({
    compress: quality,
    format: SaveFormat.JPEG,
  });

  return {
    ...asset,
    file: undefined,
    fileName: `optimized-${Date.now()}.jpg`,
    fileSize: undefined,
    height: result.height,
    mimeType: 'image/jpeg',
    uri: result.uri,
    width: result.width,
  };
}

export async function optimizeAvatarAsset(
  asset: ImagePickerAsset
) {
  return optimizeImageAsset(
    asset,
    {
      maxHeight: 512,
      maxWidth: 512,
      quality: 0.8,
    }
  );
}

export async function optimizeEventCoverAsset(
  asset: ImagePickerAsset
) {
  return optimizeImageAsset(
    asset,
    {
      maxHeight: 900,
      maxWidth: 1600,
      quality: 0.8,
    }
  );
}

export async function optimizePostImageAsset(
  asset: ImagePickerAsset
) {
  return optimizeImageAsset(
    asset,
    {
      maxHeight: 1800,
      maxWidth: 1800,
      quality: 0.8,
    }
  );
}
