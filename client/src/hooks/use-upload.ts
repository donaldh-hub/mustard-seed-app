import { useState, useCallback, useRef } from "react";
import { compressImage, validateImageType, type CompressResult } from "@/lib/imageCompress";

export type UploadStatus = "idle" | "compressing" | "uploading" | "analyzing" | "success" | "error";

export interface UploadError {
  message: string;
  code?: string;
  retryable: boolean;
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

  const setFailed = useCallback((msg: string, code?: string, retryable = true) => {
    const err: UploadError = { message: msg, code, retryable };
    setError(err);
    setStatus("error");
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

      try {
        const typeError = validateImageType(rawFile);
        if (typeError) {
          setFailed(typeError, "INVALID_TYPE", false);
          return null;
        }

        let compressed: CompressResult;
        try {
          compressed = await compressImage(rawFile);
          setCompressInfo(compressed);
        } catch (compErr: any) {
          setFailed(compErr.message || "Failed to compress image", "COMPRESS_FAILED", false);
          return null;
        }

        if (signal.aborted) throw new DOMException("Aborted", "AbortError");

        setStatus("uploading");
        setProgress(10);

        const file = compressed.file;

        const urlRes = await fetch("/api/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            contentType: file.type || "image/jpeg",
          }),
          signal,
        });

        if (!urlRes.ok) {
          const errData = await urlRes.json().catch(() => ({ error: "Server error" }));
          if (urlRes.status === 413 || errData.code === "FILE_TOO_LARGE") {
            setFailed("Image is too large. Please pick a smaller image.", "FILE_TOO_LARGE", false);
          } else if (errData.code === "INVALID_TYPE") {
            setFailed("Unsupported image format. Use JPEG, PNG, or WebP.", "INVALID_TYPE", false);
          } else {
            setFailed(errData.error || "Failed to prepare upload", errData.code);
          }
          return null;
        }

        const uploadResponse: UploadResponse = await urlRes.json();
        setProgress(30);

        const uploadTimeout = setTimeout(() => {
          if (!signal.aborted) controller.abort();
        }, 45000);

        try {
          const putRes = await fetch(uploadResponse.uploadURL, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type || "image/jpeg" },
            signal,
          });

          clearTimeout(uploadTimeout);

          if (!putRes.ok) {
            setFailed("Failed to upload file to storage. Try again.", "STORAGE_PUT_FAILED");
            return null;
          }
        } catch (putErr: any) {
          clearTimeout(uploadTimeout);
          throw putErr;
        }

        setProgress(80);
        return uploadResponse.objectPath;
      } catch (err: any) {
        if (err.name === "AbortError" || signal.aborted) {
          setFailed("Upload was cancelled or timed out. Try again.", "TIMEOUT", true);
        } else if (err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError") || err.message?.includes("network")) {
          setFailed("Network error — check your connection and try again.", "NETWORK_ERROR", true);
        } else {
          setFailed(err.message || "Upload failed", "UNKNOWN", true);
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
