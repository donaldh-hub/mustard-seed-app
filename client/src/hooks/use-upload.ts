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

        // Step 1: Get presigned URL from our server
        console.log(`[upload] Step 1: Requesting presigned URL. ${uploadMeta}`);
        let urlRes: Response;
        try {
          urlRes = await fetch("/api/uploads/request-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: file.name,
              size: file.size,
              contentType: file.type || "image/jpeg",
            }),
            signal,
          });
        } catch (fetchErr: any) {
          const detail = `POST /api/uploads/request-url failed: ${fetchErr.message}. ${uploadMeta}`;
          console.error(`[upload] ${detail}`);
          setFailed(
            "Could not reach the server. Check your connection and try again.",
            "PRESIGN_NETWORK_ERROR",
            true,
            detail
          );
          return null;
        }

        if (!urlRes.ok) {
          const errData = await urlRes.json().catch(() => ({ error: "Server error" }));
          const detail = `Presign HTTP ${urlRes.status}: ${JSON.stringify(errData)}`;
          console.error(`[upload] ${detail}`);
          if (urlRes.status === 413 || errData.code === "FILE_TOO_LARGE") {
            setFailed("Image is too large. Please pick a smaller image.", "FILE_TOO_LARGE", false, detail);
          } else if (errData.code === "INVALID_TYPE") {
            setFailed("Unsupported image format. Use JPEG, PNG, or WebP.", "INVALID_TYPE", false, detail);
          } else {
            setFailed(errData.error || `Server error (${urlRes.status})`, errData.code || "PRESIGN_ERROR", true, detail);
          }
          return null;
        }

        const uploadResponse: UploadResponse = await urlRes.json();
        const gcsUrl = uploadResponse.uploadURL;
        const gcsHost = new URL(gcsUrl).hostname;
        setProgress(30);
        console.log(`[upload] Step 1 OK: objectPath=${uploadResponse.objectPath} gcsHost=${gcsHost}`);

        // Step 2: PUT file directly to GCS presigned URL
        console.log(`[upload] Step 2: PUT to GCS. size=${file.size} type=${file.type} host=${gcsHost}`);

        const uploadTimeout = setTimeout(() => {
          if (!signal.aborted) {
            console.error(`[upload] Step 2: PUT timed out after 60s`);
            controller.abort();
          }
        }, 60000);

        let putRes: Response;
        try {
          putRes = await fetch(gcsUrl, {
            method: "PUT",
            body: file,
            headers: {
              "Content-Type": file.type || "image/jpeg",
            },
            signal,
          });
          clearTimeout(uploadTimeout);
        } catch (putErr: any) {
          clearTimeout(uploadTimeout);
          const detail = `PUT ${gcsHost} failed: ${putErr.message}. File: ${uploadMeta}`;
          console.error(`[upload] ${detail}`);

          if (putErr.name === "AbortError" || signal.aborted) {
            setFailed(
              "Upload timed out. Your connection may be slow — try a smaller image or better Wi-Fi.",
              "GCS_TIMEOUT",
              true,
              detail
            );
          } else {
            setFailed(
              `Upload to storage failed: ${putErr.message}. Try again.`,
              "GCS_PUT_FAILED",
              true,
              detail
            );
          }
          return null;
        }

        if (!putRes.ok) {
          const putBody = await putRes.text().catch(() => "");
          const detail = `PUT ${gcsHost} HTTP ${putRes.status}: ${putBody.substring(0, 200)}`;
          console.error(`[upload] ${detail}`);
          setFailed(`Storage rejected the file (HTTP ${putRes.status}). Try again.`, "GCS_PUT_HTTP_ERROR", true, detail);
          return null;
        }

        setProgress(80);
        console.log(`[upload] Step 2 OK: File stored successfully`);
        return uploadResponse.objectPath;
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
