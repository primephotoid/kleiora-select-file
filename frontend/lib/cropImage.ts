import type { Area } from 'react-easy-crop';

/**
 * Creates a cropped image file from a source image URL and a crop area.
 * @param imageSrc - A data URL or object URL of the source image.
 * @param pixelCrop - The pixel coordinates and dimensions of the crop area.
 * @param fileName - The desired file name for the output file.
 * @param fileType - The desired MIME type for the output file (e.g. 'image/jpeg').
 * @returns A Promise resolving to a cropped File object.
 */
export default function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  fileName: string,
  fileType: string = 'image/jpeg'
): Promise<File> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty or failed to create blob'));
          return;
        }
        const file = new File([blob], fileName, { type: fileType });
        resolve(file);
      }, fileType, 0.92);
    });
    image.addEventListener('error', () => reject(new Error('Failed to load image')));
    image.src = imageSrc;
  });
}
