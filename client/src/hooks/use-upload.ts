import { useState, useCallback, useRef } from "react";

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface UploadResponse {
  uploadURL: string;
  objectPath: string;
  metadata: { name: string; size: number; contentType: string };
}

interface UseUploadOptions {
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
  timeoutMs?: number;
}

export function useUpload(options: UseUploadOptions = {}) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const inflightRef = useRef(false);
  const timeoutMs = options.timeoutMs ?? 15000;

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setProgress(0);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    inflightRef.current = false;
    setStatus("idle");
    setError(null);
    setProgress(0);
  }, []);

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse | null> => {
      if (inflightRef.current) return null;
      inflightRef.current = true;

      const controller = new AbortController();
      abortRef.current = controller;
      const signal = controller.signal;

      const timer = setTimeout(() => controller.abort(), timeoutMs);

      setStatus("uploading");
      setError(null);
      setProgress(0);

      try {
        setProgress(10);
        const urlRes = await fetch("/api/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            contentType: file.type || "application/octet-stream",
          }),
          signal,
        });

        if (!urlRes.ok) {
          const errData = await urlRes.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to get upload URL");
        }

        const uploadResponse: UploadResponse = await urlRes.json();

        setProgress(30);
        const putRes = await fetch(uploadResponse.uploadURL, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
          signal,
        });

        if (!putRes.ok) {
          throw new Error("Failed to upload file to storage");
        }

        clearTimeout(timer);
        setProgress(100);
        setStatus("success");
        options.onSuccess?.(uploadResponse);
        return uploadResponse;
      } catch (err) {
        clearTimeout(timer);
        if (signal.aborted) {
          const abortErr = new Error("Upload timed out or was cancelled. Try again.");
          setError(abortErr);
          setStatus("error");
          options.onError?.(abortErr);
          return null;
        }
        const error = err instanceof Error ? err : new Error("Upload failed");
        setError(error);
        setStatus("error");
        options.onError?.(error);
        return null;
      } finally {
        inflightRef.current = false;
        abortRef.current = null;
      }
    },
    [timeoutMs, options]
  );

  const getUploadParameters = useCallback(
    async (
      file: { name: string; size?: number | null; type?: string | null }
    ): Promise<{ method: "PUT"; url: string; headers?: Record<string, string> }> => {
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }),
      });
      if (!response.ok) throw new Error("Failed to get upload URL");
      const data = await response.json();
      return {
        method: "PUT",
        url: data.uploadURL,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      };
    },
    []
  );

  return {
    uploadFile,
    getUploadParameters,
    isUploading: status === "uploading",
    status,
    error,
    progress,
    cancel,
    reset,
  };
}
