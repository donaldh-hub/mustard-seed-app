const MAX_DIMENSION = 1280;
const INITIAL_QUALITY = 0.80;
const TARGET_SIZE = 2 * 1024 * 1024;
const ABSOLUTE_MAX = 10 * 1024 * 1024;
const FALLBACK_MAX = 10 * 1024 * 1024;
const SERVER_COMPRESS_THRESHOLD = 2 * 1024 * 1024;

export interface CompressResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  wasFallback?: boolean;
  needsServerCompress?: boolean;
}

export function validateImageType(file: File): string | null {
  if (!file.type && !file.name) {
    return "Could not determine file type. Please select a JPEG, PNG, or WebP image.";
  }

  const type = (file.type || "").toLowerCase();
  const ext = file.name?.split(".").pop()?.toLowerCase() || "";

  if (type.includes("heic") || type.includes("heif") || ext === "heic" || ext === "heif") {
    return "HEIC/HEIF images aren't supported by your browser. Please select a JPEG or PNG instead.";
  }

  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"];
  const validExts = ["jpg", "jpeg", "png", "webp", "gif", "bmp"];

  if (type && !validTypes.includes(type) && !type.startsWith("image/")) {
    return "Please select an image file (JPEG, PNG, or WebP).";
  }

  if (!type && ext && !validExts.includes(ext)) {
    return "Please select an image file (JPEG, PNG, or WebP).";
  }

  return null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    const timeout = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      reject(new Error("Image load timed out after 10s"));
    }, 10000);

    img.onload = () => {
      clearTimeout(timeout);
      resolve(img);
    };

    img.onerror = (_e) => {
      clearTimeout(timeout);
      reject(new Error("Browser could not load this image via <img>"));
    };

    img.src = src;
  });
}

async function tryCreateImageBitmap(file: File): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(file);
    return bitmap;
  } catch {
    return null;
  }
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

async function bitmapToCompressed(
  bitmap: ImageBitmap,
  fileName: string,
  originalSize: number
): Promise<CompressResult> {
  let { width, height } = bitmap;

  console.log(`[compress] ImageBitmap loaded: ${width}x${height}`);

  if (width <= 0 || height <= 0) {
    bitmap.close();
    throw new Error("Image has invalid dimensions (0x0)");
  }

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
    console.log(`[compress] Resized to: ${width}x${height}`);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Canvas 2D context not available");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = INITIAL_QUALITY;
  let bestBlob: Blob | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (blob) {
      bestBlob = blob;
      console.log(`[compress] Bitmap attempt ${attempt + 1}: ${(blob.size / 1024).toFixed(0)}KB at quality=${quality.toFixed(2)}`);
      if (blob.size <= TARGET_SIZE) break;
    }
    quality -= 0.12;
    if (quality < 0.3) quality = 0.3;
  }

  canvas.width = 0;
  canvas.height = 0;

  if (!bestBlob) throw new Error("Canvas toBlob returned null");

  if (bestBlob.size > ABSOLUTE_MAX) {
    throw new Error("Still too large after bitmap compression");
  }

  const ext = fileName.replace(/\.\w+$/, "");
  const compressedFile = new File([bestBlob], `${ext}.jpg`, { type: "image/jpeg" });

  console.log(`[compress] Bitmap done: ${(originalSize / 1024).toFixed(0)}KB -> ${(compressedFile.size / 1024).toFixed(0)}KB`);

  return {
    file: compressedFile,
    originalSize,
    compressedSize: compressedFile.size,
    width,
    height,
  };
}

export async function compressImage(file: File): Promise<CompressResult> {
  const originalSize = file.size;

  console.log(`[compress] Starting: name=${file.name} type=${file.type} size=${(originalSize / 1024).toFixed(0)}KB`);

  if (originalSize <= 400 * 1024 && (file.type === "image/jpeg" || file.type === "image/png")) {
    console.log("[compress] Small file, skipping compression");
    return { file, originalSize, compressedSize: originalSize, width: 0, height: 0 };
  }

  let url: string | null = null;

  try {
    url = URL.createObjectURL(file);

    let img: HTMLImageElement | null = null;
    let imgLoadFailed = false;

    try {
      img = await loadImage(url);
    } catch (imgErr) {
      console.warn(`[compress] <img> load failed: ${(imgErr as Error).message}. Trying createImageBitmap...`);
      imgLoadFailed = true;
    }

    if (imgLoadFailed || !img) {
      const bitmap = await tryCreateImageBitmap(file);
      if (bitmap) {
        return await bitmapToCompressed(bitmap, file.name, originalSize);
      }

      try {
        console.log("[compress] Trying FileReader data URL approach...");
        const dataUrl = await readAsDataURL(file);
        img = await loadImage(dataUrl);
        imgLoadFailed = false;
        console.log(`[compress] FileReader approach worked: ${img.width}x${img.height}`);
      } catch {
        throw new Error("Browser could not load this image");
      }
    }

    let { width, height } = img;

    console.log(`[compress] Image loaded: ${width}x${height}`);

    if (width <= 0 || height <= 0) {
      throw new Error("Image has invalid dimensions (0x0)");
    }

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      console.log(`[compress] Resized to: ${width}x${height}`);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context not available");

    ctx.drawImage(img, 0, 0, width, height);

    let quality = INITIAL_QUALITY;
    let blob: Blob | null = null;
    let bestBlob: Blob | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality)
      );
      if (blob) {
        bestBlob = blob;
        console.log(`[compress] Attempt ${attempt + 1}: ${(blob.size / 1024).toFixed(0)}KB at quality=${quality.toFixed(2)}`);
        if (blob.size <= TARGET_SIZE) break;
      }
      quality -= 0.12;
      if (quality < 0.3) quality = 0.3;
    }

    canvas.width = 0;
    canvas.height = 0;

    if (!bestBlob) throw new Error("Canvas toBlob returned null");

    if (bestBlob.size > ABSOLUTE_MAX) {
      throw new Error("Still too large after compression");
    }

    const ext = file.name.replace(/\.\w+$/, "");
    const compressedFile = new File([bestBlob], `${ext}.jpg`, { type: "image/jpeg" });

    console.log(`[compress] Done: ${(originalSize / 1024).toFixed(0)}KB -> ${(compressedFile.size / 1024).toFixed(0)}KB`);

    return {
      file: compressedFile,
      originalSize,
      compressedSize: compressedFile.size,
      width,
      height,
    };
  } catch (err) {
    const msg = (err as Error).message || "Unknown compression error";
    console.warn(`[compress] Failed: ${msg}. Routing to server-side compression.`);

    if (originalSize <= FALLBACK_MAX) {
      console.log(`[compress] Server compression required: ${(originalSize / 1024).toFixed(0)}KB`);
      return {
        file,
        originalSize,
        compressedSize: originalSize,
        width: 0,
        height: 0,
        wasFallback: true,
        needsServerCompress: true,
      };
    }

    throw new Error(
      `This image is too large (${(originalSize / 1024 / 1024).toFixed(1)}MB). Maximum is ${(FALLBACK_MAX / 1024 / 1024).toFixed(0)}MB.`
    );
  } finally {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
}
