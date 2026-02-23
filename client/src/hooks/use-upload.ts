import { useState, useCallback, useRef } from "react";
import { compressImage, validateImageType, type CompressResult } from "@/lib/imageCompress";

export type UploadPhase =
  | "IDLE"
  | "PREPARING"
  | "PRESIGNING"
  | "UPLOADING_DIRECT"
  | "UPLOADING_PROXY"
  | "CONFIRMED_STORED"
  | "ANALYZING"
  | "MEMORY_SAVING"
  | "COMPLETE_SUCCESS"
  | "FAILED"
  | "CANCELED";

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

let attemptCounter = 0;
function generateAttemptId(): string {
  attemptCounter++;
  return `ua_${Date.now()}_${attemptCounter}`;
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
          code: errData.code === "FILE_TOO_LARGE" ? "FILE_TOO_LARGE" : errData.code === "INVALID_TYPE" ? "INVALID_TYPE" : "PRESIGN_FAILED",
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
        code: "PRESIGN_FAILED",
        retryable: true,
        details: `POST /api/uploads/request-url failed: ${fetchErr.message}. ${uploadMeta}`,
      },
    };
  }
}

async function directPutToGCS(
  gcsUrl: string,
  file: File,
  parentSignal: AbortSignal
): Promise<{ ok: true } | { ok: false; code: string; detail: string }> {
  const gcsHost = new URL(gcsUrl).hostname;
  const uploadMeta = `name=${file.name} type=${file.type} size=${file.size}bytes`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  const onParentAbort = () => controller.abort();
  parentSignal.addEventListener("abort", onParentAbort);

  try {
    const putRes = await fetch(gcsUrl, {
      method: "PUT",
      mode: "cors",
      body: file,
      headers: { "Content-Type": file.type || "image/jpeg" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!putRes.ok) {
      const putBody = await putRes.text().catch(() => "");
      return { ok: false, code: "DIRECT_UPLOAD_FAILED", detail: `PUT ${gcsHost} HTTP ${putRes.status}: ${putBody.substring(0, 200)}` };
    }
    return { ok: true };
  } catch (putErr: any) {
    clearTimeout(timeoutId);
    if (parentSignal.aborted) return { ok: false, code: "CANCELED_BY_USER", detail: "Cancelled by user" };
    if (putErr.name === "AbortError") return { ok: false, code: "DIRECT_UPLOAD_FAILED", detail: `PUT ${gcsHost} timed out after 60s. ${uploadMeta}` };
    return { ok: false, code: "DIRECT_UPLOAD_FAILED", detail: `PUT ${gcsHost} failed: ${putErr.message}. ${uploadMeta}` };
  } finally {
    parentSignal.removeEventListener("abort", onParentAbort);
  }
}

async function proxyUploadRaw(
  file: File,
  parentSignal: AbortSignal
): Promise<{ ok: true; objectPath: string } | { ok: false; code: string; detail: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);
  const onParentAbort = () => controller.abort();
  parentSignal.addEventListener("abort", onParentAbort);

  try {
    const arrayBuffer = await file.arrayBuffer();
    if (parentSignal.aborted) return { ok: false, code: "CANCELED_BY_USER", detail: "Cancelled by user" };

    const res = await fetch("/api/uploads/proxy-raw", {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-Original-Name": file.name,
      },
      body: arrayBuffer,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (parentSignal.aborted) return { ok: false, code: "CANCELED_BY_USER", detail: "Cancelled by user" };

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: "Proxy error" }));
      return { ok: false, code: "PROXY_UPLOAD_FAILED", detail: `Raw proxy HTTP ${res.status}: ${JSON.stringify(errData)}` };
    }

    const data = await res.json();
    if (!data.ok || !data.objectPath) {
      return { ok: false, code: "PROXY_UPLOAD_FAILED", detail: `Raw proxy invalid response: ${JSON.stringify(data)}` };
    }

    return { ok: true, objectPath: data.objectPath };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (parentSignal.aborted) return { ok: false, code: "CANCELED_BY_USER", detail: "Cancelled by user" };
    if (err.name === "AbortError") return { ok: false, code: "PROXY_UPLOAD_FAILED", detail: "Raw proxy upload timed out after 120s" };
    return { ok: false, code: "PROXY_UPLOAD_FAILED", detail: `Raw proxy fetch failed: ${err.message}` };
  } finally {
    parentSignal.removeEventListener("abort", onParentAbort);
  }
}

const CHUNK_SIZE = 1024 * 1024;

async function proxyUploadChunked(
  file: File,
  parentSignal: AbortSignal
): Promise<{ ok: true; objectPath: string } | { ok: false; code: string; detail: string }> {
  try {
    const totalBytes = file.size;
    const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);
    const uploadId = `chu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    console.log(`[chunked] Starting: ${totalChunks} chunks of ${(CHUNK_SIZE / 1024).toFixed(0)}KB each, total=${(totalBytes / 1024).toFixed(0)}KB`);

    let lastResponse: any = null;

    for (let i = 0; i < totalChunks; i++) {
      if (parentSignal.aborted) return { ok: false, code: "CANCELED_BY_USER", detail: "Cancelled by user" };

      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalBytes);
      const chunkBlob = file.slice(start, end);
      const chunkData = await chunkBlob.arrayBuffer();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const onParentAbort = () => controller.abort();
      parentSignal.addEventListener("abort", onParentAbort);

      try {
        const res = await fetch("/api/uploads/chunk", {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            "X-Upload-Id": uploadId,
            "X-Chunk-Index": String(i),
            "X-Total-Chunks": String(totalChunks),
            "X-Original-Name": file.name,
            "X-Content-Type": file.type || "image/jpeg",
          },
          body: chunkData,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        parentSignal.removeEventListener("abort", onParentAbort);

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: "Chunk error" }));
          return { ok: false, code: "CHUNK_UPLOAD_FAILED", detail: `Chunk ${i + 1}/${totalChunks} HTTP ${res.status}: ${JSON.stringify(errData)}` };
        }

        lastResponse = await res.json();
        console.log(`[chunked] Chunk ${i + 1}/${totalChunks} OK`);
      } catch (err: any) {
        clearTimeout(timeoutId);
        parentSignal.removeEventListener("abort", onParentAbort);
        if (parentSignal.aborted) return { ok: false, code: "CANCELED_BY_USER", detail: "Cancelled by user" };
        return { ok: false, code: "CHUNK_UPLOAD_FAILED", detail: `Chunk ${i + 1}/${totalChunks} failed: ${err.message}` };
      }
    }

    if (lastResponse?.complete && lastResponse?.objectPath) {
      console.log(`[chunked] Complete: ${lastResponse.objectPath}`);
      return { ok: true, objectPath: lastResponse.objectPath };
    }

    return { ok: false, code: "CHUNK_UPLOAD_FAILED", detail: `Upload incomplete: ${JSON.stringify(lastResponse)}` };
  } catch (err: any) {
    if (parentSignal.aborted) return { ok: false, code: "CANCELED_BY_USER", detail: "Cancelled by user" };
    return { ok: false, code: "CHUNK_UPLOAD_FAILED", detail: `Chunked upload error: ${err.message}` };
  }
}

async function proxyUploadFormData(
  file: File,
  parentSignal: AbortSignal
): Promise<{ ok: true; objectPath: string } | { ok: false; code: string; detail: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);
  const onParentAbort = () => controller.abort();
  parentSignal.addEventListener("abort", onParentAbort);

  try {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const res = await fetch("/api/uploads/proxy", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (parentSignal.aborted) return { ok: false, code: "CANCELED_BY_USER", detail: "Cancelled by user" };

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
    clearTimeout(timeoutId);
    if (parentSignal.aborted) return { ok: false, code: "CANCELED_BY_USER", detail: "Cancelled by user" };
    if (err.name === "AbortError") return { ok: false, code: "PROXY_UPLOAD_FAILED", detail: "Proxy upload timed out after 90s" };
    return { ok: false, code: "PROXY_UPLOAD_FAILED", detail: `Proxy fetch failed: ${err.message}` };
  } finally {
    parentSignal.removeEventListener("abort", onParentAbort);
  }
}

export function useUpload(options: UseUploadOptions = {}) {
  const [phase, setPhase] = useState<UploadPhase>("IDLE");
  const [error, setError] = useState<UploadError | null>(null);
  const [progress, setProgress] = useState(0);
  const [compressInfo, setCompressInfo] = useState<CompressResult | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [uploadMethod, setUploadMethod] = useState<"direct" | "proxy" | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inflightRef = useRef(false);
  const cancelledRef = useRef(false);

  const reset = useCallback(() => {
    setPhase("IDLE");
    setError(null);
    setProgress(0);
    setCompressInfo(null);
    setAttemptId(null);
    setUploadMethod(null);
    cancelledRef.current = false;
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    inflightRef.current = false;
    setPhase("CANCELED");
    setError(null);
    setProgress(0);
  }, []);

  const fail = useCallback((msg: string, code?: string, retryable = true, details?: string) => {
    const err: UploadError = { message: msg, code, retryable, details };
    setError(err);
    setPhase("FAILED");
    console.error(`[upload] FAILED [${code}]: ${msg}`, details ? `| ${details}` : "");
    options.onError?.(err);
    return err;
  }, [options]);

  const uploadFile = useCallback(
    async (rawFile: File): Promise<{ objectPath: string; attemptId: string } | null> => {
      if (inflightRef.current) return null;
      inflightRef.current = true;
      cancelledRef.current = false;

      const controller = new AbortController();
      abortRef.current = controller;
      const signal = controller.signal;

      const currentAttemptId = generateAttemptId();
      setAttemptId(currentAttemptId);

      setPhase("PREPARING");
      setError(null);
      setProgress(0);
      setUploadMethod(null);

      const fileMeta = `name=${rawFile.name} type=${rawFile.type || "unknown"} size=${rawFile.size}bytes (${(rawFile.size / 1024 / 1024).toFixed(2)}MB)`;
      console.log(`[upload:${currentAttemptId}] START: ${fileMeta}`);

      try {
        const typeError = validateImageType(rawFile);
        if (typeError) {
          fail(typeError, "INVALID_TYPE", false, fileMeta);
          return null;
        }

        let compressed: CompressResult;
        try {
          compressed = await compressImage(rawFile);
          setCompressInfo(compressed);
          console.log(`[upload:${currentAttemptId}] PREPARED: original=${compressed.originalSize} compressed=${compressed.compressedSize} fallback=${!!compressed.wasFallback}`);
        } catch (compErr: any) {
          fail(compErr.message || "Failed to process image", "COMPRESS_FAILED", false, fileMeta);
          return null;
        }

        if (cancelledRef.current || signal.aborted) { setPhase("CANCELED"); return null; }

        const file = compressed.file;
        const uploadMeta = `name=${file.name} type=${file.type} size=${file.size}bytes`;
        const skipDirectPut = !!compressed.needsServerCompress;

        let objectPath: string | null = null;

        // ─── PRESIGN + DIRECT PUT (skip if needs server compression) ───
        if (skipDirectPut) {
          console.log(`[upload:${currentAttemptId}] Skipping direct PUT — needs server compression`);
        } else {
          setPhase("PRESIGNING");
          setProgress(10);

          const presign1 = await requestPresignedUrl(file, signal);
          if (cancelledRef.current || signal.aborted) { setPhase("CANCELED"); return null; }

          if (presign1.ok) {
            setPhase("UPLOADING_DIRECT");
            setProgress(25);
            console.log(`[upload:${currentAttemptId}] DIRECT PUT attempt 1`);

            const put1 = await directPutToGCS(presign1.data.uploadURL, file, signal);
            if (cancelledRef.current || signal.aborted) { setPhase("CANCELED"); return null; }

            if (put1.ok) {
              objectPath = presign1.data.objectPath;
              setUploadMethod("direct");
              console.log(`[upload:${currentAttemptId}] DIRECT PUT 1 OK: ${objectPath}`);
            } else {
              console.warn(`[upload:${currentAttemptId}] DIRECT PUT 1 FAIL: [${put1.code}] ${put1.detail}`);
              if (put1.code !== "CANCELED_BY_USER") {
                console.log(`[upload:${currentAttemptId}] Retrying with fresh presigned URL`);
                setProgress(30);
                const presign2 = await requestPresignedUrl(file, signal);
                if (cancelledRef.current || signal.aborted) { setPhase("CANCELED"); return null; }

                if (presign2.ok) {
                  const put2 = await directPutToGCS(presign2.data.uploadURL, file, signal);
                  if (cancelledRef.current || signal.aborted) { setPhase("CANCELED"); return null; }

                  if (put2.ok) {
                    objectPath = presign2.data.objectPath;
                    setUploadMethod("direct");
                    console.log(`[upload:${currentAttemptId}] DIRECT PUT 2 OK: ${objectPath}`);
                  } else {
                    console.warn(`[upload:${currentAttemptId}] DIRECT PUT 2 FAIL: [${put2.code}] ${put2.detail}`);
                  }
                } else {
                  console.warn(`[upload:${currentAttemptId}] PRESIGN 2 FAIL: [${presign2.error.code}]`);
                }
              }
            }
          } else {
            console.warn(`[upload:${currentAttemptId}] PRESIGN FAIL: [${presign1.error.code}] ${presign1.error.details}`);
          }
        }

        if (cancelledRef.current || signal.aborted) { setPhase("CANCELED"); return null; }

        // ─── PROXY FALLBACK (or primary path for server-compressed files) ───
        if (!objectPath) {
          setPhase("UPLOADING_PROXY");
          setProgress(40);
          console.log(`[upload:${currentAttemptId}] RAW PROXY upload. ${uploadMeta}`);

          const rawResult = await proxyUploadRaw(file, signal);
          if (cancelledRef.current || signal.aborted) { setPhase("CANCELED"); return null; }

          if (rawResult.ok) {
            objectPath = rawResult.objectPath;
            setUploadMethod("proxy");
            console.log(`[upload:${currentAttemptId}] RAW PROXY OK: ${objectPath}`);
          } else {
            console.warn(`[upload:${currentAttemptId}] RAW PROXY FAIL: [${rawResult.code}] ${rawResult.detail}. Trying chunked upload...`);

            const chunkedResult = await proxyUploadChunked(file, signal);
            if (cancelledRef.current || signal.aborted) { setPhase("CANCELED"); return null; }

            if (chunkedResult.ok) {
              objectPath = chunkedResult.objectPath;
              setUploadMethod("proxy");
              console.log(`[upload:${currentAttemptId}] CHUNKED UPLOAD OK: ${objectPath}`);
            } else {
              console.warn(`[upload:${currentAttemptId}] CHUNKED FAIL: [${chunkedResult.code}] ${chunkedResult.detail}. Trying FormData proxy...`);

              const formResult = await proxyUploadFormData(file, signal);
              if (cancelledRef.current || signal.aborted) { setPhase("CANCELED"); return null; }

              if (formResult.ok) {
                objectPath = formResult.objectPath;
                setUploadMethod("proxy");
                console.log(`[upload:${currentAttemptId}] FORMDATA PROXY OK: ${objectPath}`);
              } else {
                console.error(`[upload:${currentAttemptId}] ALL PROXY METHODS FAILED: [${formResult.code}] ${formResult.detail}`);
                fail(
                  "Upload failed. Tap Retry to try again.",
                  formResult.code,
                  true,
                  formResult.detail
                );
                return null;
              }
            }
          }
        }

        // ─── CONFIRMED STORED ───
        setPhase("CONFIRMED_STORED");
        setProgress(75);
        console.log(`[upload:${currentAttemptId}] CONFIRMED_STORED via ${objectPath ? (uploadMethod || "proxy") : "unknown"}: ${objectPath}`);

        return { objectPath: objectPath!, attemptId: currentAttemptId };
      } catch (err: any) {
        if (cancelledRef.current || err.name === "AbortError" || signal?.aborted) {
          setPhase("CANCELED");
        } else {
          fail(err.message || "Upload failed", "UNKNOWN", true, fileMeta);
        }
        return null;
      } finally {
        inflightRef.current = false;
        abortRef.current = null;
      }
    },
    [options, fail]
  );

  const setAnalyzing = useCallback(() => {
    setPhase("ANALYZING");
    setProgress(85);
  }, []);

  const setMemorySaving = useCallback(() => {
    setPhase("MEMORY_SAVING");
    setProgress(92);
  }, []);

  const setCompleteSuccess = useCallback(() => {
    setPhase("COMPLETE_SUCCESS");
    setProgress(100);
  }, []);

  const isActive = phase === "PREPARING" || phase === "PRESIGNING" || phase === "UPLOADING_DIRECT" || phase === "UPLOADING_PROXY";
  const isPostUpload = phase === "CONFIRMED_STORED" || phase === "ANALYZING" || phase === "MEMORY_SAVING";
  const isBusy = isActive || isPostUpload;

  return {
    uploadFile,
    setAnalyzing,
    setMemorySaving,
    setCompleteSuccess,
    phase,
    isActive,
    isPostUpload,
    isBusy,
    error,
    progress,
    compressInfo,
    attemptId,
    uploadMethod,
    cancel,
    reset,
    fail,
  };
}
