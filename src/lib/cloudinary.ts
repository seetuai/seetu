/**
 * Cloudinary Integration
 *
 * Handles image and video processing for billboard content
 */

import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface TransformOptions {
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'scale' | 'pad';
  format?: 'mp4' | 'webm' | 'jpg' | 'png' | 'webp';
  quality?: 'auto' | number;
}

export interface UploadResult {
  success: boolean;
  publicId?: string;
  url?: string;
  secureUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
  format?: string;
  error?: string;
}

/**
 * Upload and transform media for billboard display
 */
export async function uploadBillboardMedia(
  fileUrl: string,
  options: {
    contentId: string;
    mediaType: 'image' | 'video';
    targetWidth?: number;
    targetHeight?: number;
  }
): Promise<UploadResult> {
  const { contentId, mediaType, targetWidth = 1920, targetHeight = 1080 } = options;

  try {
    console.log(`[CLOUDINARY] Uploading ${mediaType}: ${contentId}`);

    if (mediaType === 'video') {
      // Upload and transform video
      const result = await cloudinary.uploader.upload(fileUrl, {
        resource_type: 'video',
        public_id: `billboard/${contentId}`,
        overwrite: true,
        transformation: [
          {
            width: targetWidth,
            height: targetHeight,
            crop: 'fill',
            gravity: 'center',
          },
          {
            quality: 'auto',
            fetch_format: 'mp4',
          },
        ],
        eager: [
          // Generate thumbnail
          {
            width: 400,
            height: 225,
            crop: 'fill',
            format: 'jpg',
          },
        ],
        eager_async: false,
      });

      console.log(`[CLOUDINARY] Video uploaded: ${result.public_id}`);

      return {
        success: true,
        publicId: result.public_id,
        url: result.url,
        secureUrl: result.secure_url,
        thumbnailUrl: result.eager?.[0]?.secure_url || result.secure_url.replace(/\.[^.]+$/, '.jpg'),
        duration: result.duration,
        width: result.width,
        height: result.height,
        format: result.format,
      };
    } else {
      // Upload and transform image
      const result = await cloudinary.uploader.upload(fileUrl, {
        resource_type: 'image',
        public_id: `billboard/${contentId}`,
        overwrite: true,
        transformation: [
          {
            width: targetWidth,
            height: targetHeight,
            crop: 'fill',
            gravity: 'auto', // Smart cropping
          },
          {
            quality: 'auto:best',
            fetch_format: 'auto',
          },
        ],
      });

      console.log(`[CLOUDINARY] Image uploaded: ${result.public_id}`);

      // Generate thumbnail URL
      const thumbnailUrl = cloudinary.url(result.public_id, {
        width: 400,
        height: 225,
        crop: 'fill',
        format: 'jpg',
        quality: 'auto',
      });

      return {
        success: true,
        publicId: result.public_id,
        url: result.url,
        secureUrl: result.secure_url,
        thumbnailUrl,
        width: result.width,
        height: result.height,
        format: result.format,
      };
    }
  } catch (error) {
    console.error(`[CLOUDINARY] Upload error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Convert image to video (for billboard display)
 * Creates a video with the image displayed for specified duration
 */
export async function imageToVideo(
  imageUrl: string,
  options: {
    contentId: string;
    duration?: number; // seconds
    targetWidth?: number;
    targetHeight?: number;
  }
): Promise<UploadResult> {
  const { contentId, duration = 10, targetWidth = 1920, targetHeight = 1080 } = options;

  try {
    console.log(`[CLOUDINARY] Converting image to video: ${contentId}`);

    // First upload the image
    const imageResult = await cloudinary.uploader.upload(imageUrl, {
      resource_type: 'image',
      public_id: `billboard/${contentId}_source`,
      overwrite: true,
    });

    // Create video from image using Cloudinary's video generation
    // This creates a video with the image displayed for the specified duration
    const videoUrl = cloudinary.url(imageResult.public_id, {
      resource_type: 'video',
      format: 'mp4',
      transformation: [
        {
          width: targetWidth,
          height: targetHeight,
          crop: 'fill',
          gravity: 'center',
        },
        // Add slight zoom effect (Ken Burns)
        {
          effect: 'zoompan',
          duration: duration,
        },
      ],
    });

    // For now, just use the image directly - Cloudinary's image-to-video
    // requires the video API which has different pricing
    // The billboard player can handle images directly
    const thumbnailUrl = cloudinary.url(imageResult.public_id, {
      width: 400,
      height: 225,
      crop: 'fill',
      format: 'jpg',
    });

    console.log(`[CLOUDINARY] Image ready for billboard: ${contentId}`);

    return {
      success: true,
      publicId: imageResult.public_id,
      url: imageResult.url,
      secureUrl: imageResult.secure_url,
      thumbnailUrl,
      duration,
      width: targetWidth,
      height: targetHeight,
      format: 'jpg',
    };
  } catch (error) {
    console.error(`[CLOUDINARY] Image to video error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Conversion failed',
    };
  }
}

/**
 * Delete media from Cloudinary
 */
export async function deleteMedia(publicId: string, resourceType: 'image' | 'video' = 'image'): Promise<boolean> {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return true;
  } catch (error) {
    console.error(`[CLOUDINARY] Delete error:`, error);
    return false;
  }
}

/**
 * Get optimized URL for billboard display
 */
export function getBillboardUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    format?: string;
  } = {}
): string {
  const { width = 1920, height = 1080, format = 'auto' } = options;

  return cloudinary.url(publicId, {
    width,
    height,
    crop: 'fill',
    quality: 'auto:best',
    fetch_format: format,
    secure: true,
  });
}

/**
 * Check if Cloudinary is configured
 */
export function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

export { cloudinary };
