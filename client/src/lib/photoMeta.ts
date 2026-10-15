// What the server needs to judge whether a photo is today's proof
// (server/photoProof.ts): a fingerprint of the original file (to catch the
// same image twice), the file's date, and the camera's capture date when the
// file has one. Read from the original file, before compression strips EXIF.

export interface PhotoMeta {
  contentHash: string | null;
  lastModified: number | null;
  capturedAt: number | null;
}

async function sha256Hex(buf: ArrayBuffer): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null; // crypto.subtle needs a secure context
  }
}

// EXIF DateTimeOriginal (or DateTime) from a JPEG, as local time. null when
// there's no EXIF (screenshots, downloads, most edited or web images).
export function readExifCaptureTime(buf: ArrayBuffer): number | null {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null;
  let off = 2;
  while (off + 4 < v.byteLength) {
    const marker = v.getUint16(off);
    const size = v.getUint16(off + 2);
    if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) return parseTiff(v, off + 10);
    if ((marker & 0xff00) !== 0xff00 || size < 2) return null;
    off += 2 + size;
  }
  return null;
}

function parseTiff(v: DataView, tiff: number): number | null {
  if (tiff + 8 > v.byteLength) return null;
  const little = v.getUint16(tiff) === 0x4949;
  const u16 = (o: number) => v.getUint16(o, little);
  const u32 = (o: number) => v.getUint32(o, little);
  const readIfd = (ifd: number): Map<number, number> => {
    const tags = new Map<number, number>();
    if (ifd + 2 > v.byteLength) return tags;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (e + 12 > v.byteLength) break;
      tags.set(u16(e), e);
    }
    return tags;
  };
  const ascii = (entry: number): string | null => {
    const count = u32(entry + 4);
    const at = count > 4 ? tiff + u32(entry + 8) : entry + 8;
    if (at + count > v.byteLength) return null;
    let s = "";
    for (let i = 0; i < count - 1; i++) s += String.fromCharCode(v.getUint8(at + i));
    return s;
  };
  const toTime = (s: string | null): number | null => {
    const m = s?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    const t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
    return Number.isNaN(t) ? null : t;
  };
  const ifd0 = readIfd(tiff + u32(tiff + 4));
  const exifPtr = ifd0.get(0x8769);
  if (exifPtr !== undefined) {
    const exif = readIfd(tiff + u32(exifPtr + 8));
    const original = exif.get(0x9003);
    if (original !== undefined) {
      const t = toTime(ascii(original));
      if (t) return t;
    }
  }
  const dt = ifd0.get(0x0132);
  return dt !== undefined ? toTime(ascii(dt)) : null;
}

export async function readPhotoMeta(file: File): Promise<PhotoMeta> {
  try {
    const buf = await file.arrayBuffer();
    return {
      contentHash: await sha256Hex(buf),
      lastModified: Number.isFinite(file.lastModified) && file.lastModified > 0 ? file.lastModified : null,
      capturedAt: readExifCaptureTime(buf),
    };
  } catch {
    return { contentHash: null, lastModified: null, capturedAt: null };
  }
}

// Phones and tablets have a real camera behind <input capture>; desktop
// browsers just open a file picker, so there's no "Take Photo" there.
export function canCaptureWithCamera(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return coarse || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
