import { useState, useCallback, useRef } from "react";
import { compressImage, validateImageType, type CompressResult } from "@/lib/imageCompress";

export type UploadStatus = "idle" | "compressing" | "uploading" | "analyzing" | "success" | "error";

export interface UploadError {
  message: string;
  code?: string;
  retryable: boolean;
  details?: string;
}

interface UploadResponse {
  uploadURL: string;
  objectPath: string;
  metadata: { name: string; size: number; contentType: string };
}

interface UseUploadOptions {
  onError?: (error: UploadError) => void;
}

async function requestPresignedUrl(
  file: File,
  signal: AbortSignal
): Promise<{ ok: true; data: UploadResponse } | { ok: false; error: UploadError }> {
  const uploadMeta = `name=${file.name} type=${file.type} size=${file.size}bytes`;
  try {
    const res = await fetch("/api/uploads/request-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        contentType: file.type || "image/jpeg",
      }),
      signal,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: "Server error" }));
      return {
        ok: false,
        error: {
          message: errData.error || `Server error (${res.status})`,
          code: errData.code || "PRESIGN_ERROR",
          retryable: res.status !== 413 && errData.code !== "INVALID_TYPE",
          details: `Presign HTTP ${res.status}: ${JSON.stringify(errData)}`,
        },
      };
    }

    const data: UploadResponse = await res.json();
    return { ok: true, data };
  } catch (fetchErr: any) {
    return {
      ok: false,
      error: {
        message: "Could not reach the server. Check your connection and try again.",
        code: "PRESIGN_NETWORK_ERROR",
        retryable: true,
        details: `POST /api/uploads/request-url failed: ${fetchErr.message}. ${uploadMeta}`,
      },
    };
  }
}

async function directPutToGCS(
  gcsUrl: string,
  file: File,
  signal: AbortSignal
): Promise<{ ok: true } | { ok: false; code: string; detail: string }> {
  const gcsHost = new URL(gcsUrl).hostname;
  const uploadMeta = `name=${file.name} type=${file.type} size=${file.size}bytes`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  const combinedSignal = signal;

  try {
    const putRes = await fetch(gcsUrl, {
      method: "PUT",
      mode: "cors",
      body: file,
      headers: {
        "Content-Type": file.type || "image/jpeg",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (combinedSignal.aborted) {
      return { ok: false, code: "ABORT", detail: "Cancelled" };
    }

    if (!putRes.ok) {
      const putBody = await putRes.text().catch(() => "");
      return {
        ok: false,
        code: "DIRECT_PUT_HTTP_ERROR",
        detail: `PUT ${gcsHost} HTTP ${putRes.status}: ${putBody.substring(0, 200)}`,
      };
    }

    return { ok: true };
  } catch (putErr: any) {
    clearTimeout(timeout);
    if (putErr.name === "AbortError") {
      return { ok: false, code: "DIRECT_PUT_TIMEOUT", detail: `PUT ${gcsHost} timed out. ${uploadMeta}` };
    }
    return { ok: false, code: "DIRECT_PUT_FAILED", detail: `PUT ${gcsHost} failed: ${putErr.message}. ${uploadMeta}` };
  }
}

async function proxyUpload(
  file: File,
  signal: AbortSignal
): Promise<{ ok: true; objectPath: string } | { ok: false; code: string; detail: string }> {
  try {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    const res = await fetch("/api/uploads/proxy", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (signal.aborted) {
      return { ok: false, code: "ABORT", detail: "Cancelled" };
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: "Proxy error" }));
      return { ok: false, code: "PROXY_UPLOAD_FAILED", detail: `Proxy HTTP ${res.status}: ${JSON.stringify(errData)}` };
    }

    const data = await res.json();
    if (!data.ok || !data.objectPath) {
      return { ok: false, code: "PROXY_UPLOAD_FAILED", detail: `Proxy returned invalid response: ${JSON.stringify(data)}` };
    }

    return { ok: true, objectPath: data.objectPath };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { ok: false, code: "PROXY_TIMEOUT", detail: "Proxy upload timed out after 90s" };
    }
    return { ok: false, code: "PROXY_UPLOAD_FAILED", detail: `Proxy fetch failed: ${err.message}` };
  }
}

export function useUpload(options: UseUploadOptions = {}) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<UploadError | null>(null);
  const [progress, setProgress] = useState(0);
  const [compressInfo, setCompressInfo] = useState<CompressResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inflightRef = useRef(false);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setProgress(0);
    setCompressInfo(null);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    inflightRef.current = false;
    reset();
  }, [reset]);

  const setFailed = useCallback((msg: string, code?: string, retryable = true, details?: string) => {
    const err: UploadError = { message: msg, code, retryable, details };
    setError(err);
    setStatus("error");
    console.error(`[upload] FAILED: ${msg}`, { code, details });
    options.onError?.(err);
    return err;
  }, [options]);

  const setAnalyzing = useCallback(() => {
    setStatus("analyzing");
    setProgress(90);
  }, []);

  const setSuccess = useCallback(() => {
    setStatus("success");
    setProgress(100);
  }, []);

  const uploadFile = useCallback(
    async (rawFile: File): Promise<string | null> => {
      if (inflightRef.current) return null;
      inflightRef.current = true;

      const controller = new AbortController();
      abortRef.current = controller;
      const signal = controller.signal;

      setStatus("compressing");
      setError(null);
      setProgress(0);

      const fileMeta = `name=${rawFile.name} type=${rawFile.type || "unknown"} size=${rawFile.size}bytes (${(rawFile.size / 1024 / 1024).toFixed(2)}MB)`;
      console.log(`[upload] Starting upload: ${fileMeta}`);

      try {
        const typeError = validateImageType(rawFile);
        if (typeError) {
          setFailed(typeError, "INVALID_TYPE", false, fileMeta);
          return null;
        }

        let compressed: CompressResult;
        try {
          compressed = await compressImage(rawFile);
          setCompressInfo(compressed);
          console.log(`[upload] Compression done: original=${compressed.originalSize} compressed=${compressed.compressedSize} fallback=${!!compressed.wasFallback}`);
        } catch (compErr: any) {
          setFailed(compErr.message || "Failed to process image", "COMPRESS_FAILED", false, fileMeta);
          return null;
        }

        if (signal.aborted) throw new DOMException("Aborted", "AbortError");

        setStatus("uploading");
        setProgress(10);

        const file = compressed.file;
        const uploadMeta = `name=${file.name} type=${file.type} size=${file.size}bytes`;

        // ─── STEP 1: Try direct GCS PUT (attempt 1) ───
        console.log(`[upload] Step 1: Direct PUT attempt 1. ${uploadMeta}`);

        const presign1 = await requestPresignedUrl(file, signal);
        if (!presign1.ok) {
          console.warn(`[upload] Presign 1 failed: ${presign1.error.code}`);
          // If presign itself fails, skip to proxy
          console.log(`[upload] Skipping to proxy fallback`);
        }

        let directSuccess = false;
        let objectPath: string | null = null;

        if (presign1.ok) {
          setProgress(25);
          console.log(`[upload] Direct PUT 1 to ${new URL(presign1.data.uploadURL).hostname}`);

          const put1 = await directPutToGCS(presign1.data.uploadURL, file, signal);
          if (put1.ok) {
            directSuccess = true;
            objectPath = presign1.data.objectPath;
            console.log(`[upload] Direct PUT 1 succeeded: ${objectPath}`);
          } else {
            console.warn(`[upload] Direct PUT 1 failed: [${put1.code}] ${put1.detail}`);

            // ─── STEP 2: Retry with fresh presigned URL ───
            if (put1.code !== "ABORT") {
              console.log(`[upload] Step 2: Retrying with fresh presigned URL`);
              setProgress(35);

              const presign2 = await requestPresignedUrl(file, signal);
              if (presign2.ok) {
                const put2 = await directPutToGCS(presign2.data.uploadURL, file, signal);
                if (put2.ok) {
                  directSuccess = true;
                  objectPath = presign2.data.objectPath;
                  console.log(`[upload] Direct PUT 2 (retry) succeeded: ${objectPath}`);
                } else {
                  console.warn(`[upload] Direct PUT 2 failed: [${put2.code}] ${put2.detail}`);
                }
              } else {
                console.warn(`[upload] Presign 2 failed: ${presign2.error.code}`);
              }
            }
          }
        }

        if (signal.aborted) throw new DOMException("Aborted", "AbortError");

        // ─── STEP 3: Proxy fallback ───
        if (!directSuccess) {
          console.log(`[upload] Step 3: Proxy fallback. ${uploadMeta}`);
          setProgress(45);

          const proxyResult = await proxyUpload(file, signal);
          if (proxyResult.ok) {
            objectPath = proxyResult.objectPath;
            console.log(`[upload] Proxy succeeded: ${objectPath}`);
          } else {
            console.error(`[upload] Proxy failed: [${proxyResult.code}] ${proxyResult.detail}`);
            setFailed(
              "Photo upload failed after all attempts. Please try again on a stronger connection.",
              proxyResult.code,
              true,
              proxyResult.detail
            );
            return null;
          }
        }

        setProgress(80);
        console.log(`[upload] Upload complete via ${directSuccess ? "direct" : "proxy"}: ${objectPath}`);
        return objectPath;
      } catch (err: any) {
        if (err.name === "AbortError" || signal?.aborted) {
          setFailed("Upload was cancelled or timed out. Try again.", "ABORT", true);
        } else {
          setFailed(err.message || "Upload failed", "UNKNOWN", true, fileMeta);
        }
        return null;
      } finally {
        inflightRef.current = false;
        abortRef.current = null;
      }
    },
    [options, setFailed]
  );

  return {
    uploadFile,
    setAnalyzing,
    setSuccess,
    isUploading: status === "uploading" || status === "compressing",
    status,
    error,
    progress,
    compressInfo,
    cancel,
    reset,
    setFailed,
  };
}
