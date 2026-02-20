const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.80;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export interface CompressResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
}

export function validateImageType(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "Please select an image file (JPEG, PNG, or WebP).";
  }
  if (ALLOWED_TYPES.length > 0 && !ALLOWED_TYPES.some((t) => file.type.startsWith(t.replace("image/", "image/")))) {
    return "Unsupported image format. Use JPEG, PNG, or WebP.";
  }
  return null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for compression"));
    img.src = src;
  });
}

export async function compressImage(file: File): Promise<CompressResult> {
  const originalSize = file.size;

  if (file.size <= 500 * 1024 && file.type === "image/jpeg") {
    return { file, originalSize, compressedSize: file.size, width: 0, height: 0 };
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    let { width, height } = img;

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
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

    if (!blob) throw new Error("Image compression failed");

    if (blob.size > MAX_FILE_SIZE) {
      throw new Error(`Image is still too large after compression (${(blob.size / 1024 / 1024).toFixed(1)}MB). Please use a smaller image.`);
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
  } finally {
    URL.revokeObjectURL(url);
  }
}
