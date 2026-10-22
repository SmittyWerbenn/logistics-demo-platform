/** Max raw file size accepted before client-side compression runs. Generous
 * enough for a full-resolution phone camera photo (typically 3-8MB), while
 * still rejecting pathological cases (wrong file picked, RAW/video export)
 * before they hang the compression step on slower devices. */
export const MAX_PHOTO_SIZE_MB = 10;
const MAX_PHOTO_SIZE_BYTES = MAX_PHOTO_SIZE_MB * 1024 * 1024;

/** Returns an error message if `file` exceeds the upload size limit, or null
 * if it's fine. Call this before compressImage so oversized files get a
 * clear, specific message instead of failing partway through compression. */
export function checkPhotoSize(file: File): string | null {
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return `Ukuran foto maksimal ${MAX_PHOTO_SIZE_MB}MB (file ini ${(file.size / 1024 / 1024).toFixed(1)}MB).`;
  }
  return null;
}

/**
 * Reads an image file and returns a compressed JPEG data URL, downscaled so
 * its longest side is at most `maxDimension`. Uploaded photos (e.g. straight
 * from a phone camera) can be several MB raw; storing that many times over
 * in localStorage as base64 easily blows past the browser's storage quota
 * and crashes the app (see ShipmentContext's persist effect). Compressing
 * client-side keeps every stored shipment small and fast to load.
 */
export function compressImage(file: File, maxDimension = 1280, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Gagal membaca file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Gagal memuat gambar."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          // Canvas unsupported for some reason - fall back to the original.
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
