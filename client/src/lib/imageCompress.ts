const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.80;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const FALLBACK_MAX = 8 * 1024 * 1024;

export interface CompressResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  wasFallback?: boolean;
}

export function validateImageType(file: File): string | null {
  if (!file.type && !file.name) {
    return "Could not determine file type. Please select a JPEG, PNG, or WebP image.";
  }

  const type = file.type.toLowerCase();
  const ext = file.name?.split(".").pop()?.toLowerCase() || "";

  if (type.includes("heic") || type.includes("heif") || ext === "heic" || ext === "heif") {
    return "HEIC/HEIF images aren't supported by your browser. Please select a JPEG or PNG instead.";
  }

  if (!type.startsWith("image/") && !["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(ext)) {
    return "Please select an image file (JPEG, PNG, or WebP).";
  }

  return null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    const timeout = setTimeout(() => {
      reject(new Error("Image load timed out"));
    }, 15000);

    img.onload = () => {
      clearTimeout(timeout);
      if (typeof img.decode === "function") {
        img.decode().then(() => resolve(img)).catch(() => resolve(img));
      } else {
        resolve(img);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Browser could not decode this image"));
    };

    img.src = src;
  });
}

export async function compressImage(file: File): Promise<CompressResult> {
  const originalSize = file.size;

  if (file.size <= 500 * 1024 && file.type === "image/jpeg") {
    return { file, originalSize, compressedSize: file.size, width: 0, height: 0 };
  }

  let url: string | null = null;

  try {
    url = URL.createObjectURL(file);
    const img = await loadImage(url);
    let { width, height } = img;

    if (width <= 0 || height <= 0) {
      throw new Error("Image has zero dimensions");
    }

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    if (width <= 0 || height <= 0) {
      throw new Error("Image dimensions invalid after resize calculation");
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(img, 0, 0, width, height);

    let quality = JPEG_QUALITY;
    let blob: Blob | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality)
      );
      if (blob && blob.size <= MAX_FILE_SIZE) break;
      quality -= 0.15;
    }

    if (!blob) throw new Error("Canvas toBlob returned null");

    if (blob.size > MAX_FILE_SIZE) {
      throw new Error("Compressed image still too large");
    }

    const compressedFile = new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
      type: "image/jpeg",
    });

    return {
      file: compressedFile,
      originalSize,
      compressedSize: compressedFile.size,
      width,
      height,
    };
  } catch (err) {
    console.warn("[imageCompress] Compression failed, attempting fallback:", (err as Error).message);

    if (originalSize <= FALLBACK_MAX) {
      return {
        file,
        originalSize,
        compressedSize: originalSize,
        width: 0,
        height: 0,
        wasFallback: true,
      };
    }

    throw new Error("This image couldn't be processed and is too large to upload as-is. Please select a smaller JPEG or PNG photo.");
  } finally {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
}
