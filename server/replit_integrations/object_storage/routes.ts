import type { Express } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

/**
 * Register object storage routes for file uploads.
 *
 * This provides example routes for the presigned URL upload flow:
 * 1. POST /api/uploads/request-url - Get a presigned URL for uploading
 * 2. The client then uploads directly to the presigned URL
 *
 * IMPORTANT: These are example routes. Customize based on your use case:
 * - Add authentication middleware for protected uploads
 * - Add file metadata storage (save to database after upload)
 * - Add ACL policies for access control
 */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Request a presigned URL for file upload.
   *
   * Request body (JSON):
   * {
   *   "name": "filename.jpg",
   *   "size": 12345,
   *   "contentType": "image/jpeg"
   * }
   *
   * Response:
   * {
   *   "uploadURL": "https://storage.googleapis.com/...",
   *   "objectPath": "/objects/uploads/uuid"
   * }
   *
   * IMPORTANT: The client should NOT send the file to this endpoint.
   * Send JSON metadata only, then upload the file directly to uploadURL.
   */
  let presignHitCount = 0;

  app.post("/api/uploads/request-url", async (req, res) => {
    presignHitCount++;
    const hitNum = presignHitCount;
    const origin = req.get("origin") || req.get("referer") || "unknown";
    const contentLength = req.get("content-length") || "unknown";
    const userAgent = (req.get("user-agent") || "unknown").substring(0, 80);

    try {
      const { name, size, contentType } = req.body;

      console.log(`[UPLOAD #${hitNum}] Presign hit: origin=${origin} content-length=${contentLength} ua=${userAgent}`);
      console.log(`[UPLOAD #${hitNum}] Body: name=${name || "MISSING"} size=${size || "MISSING"} type=${contentType || "MISSING"}`);

      if (!name) {
        console.log(`[UPLOAD #${hitNum}] Rejected: missing name`);
        return res.status(400).json({
          ok: false,
          error: "Missing required field: name",
          code: "MISSING_NAME",
        });
      }

      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

      if (size && size > MAX_FILE_SIZE) {
        console.log(`[UPLOAD #${hitNum}] Rejected: too large (${(size / 1024 / 1024).toFixed(1)}MB)`);
        return res.status(413).json({
          ok: false,
          error: `File too large (${(size / 1024 / 1024).toFixed(1)}MB). Maximum is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
          code: "FILE_TOO_LARGE",
        });
      }

      if (contentType && !ALLOWED_TYPES.includes(contentType)) {
        console.log(`[UPLOAD #${hitNum}] Rejected: invalid type (${contentType})`);
        return res.status(400).json({
          ok: false,
          error: "Unsupported file type. Use JPEG, PNG, or WebP.",
          code: "INVALID_TYPE",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      console.log(`[UPLOAD #${hitNum}] Presign OK: objectPath=${objectPath}`);

      res.json({
        ok: true,
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      });
    } catch (error: any) {
      console.error(`[UPLOAD #${hitNum}] Presign ERROR:`, error?.message || error);
      res.status(500).json({ ok: false, error: "Failed to generate upload URL", code: "SERVER_ERROR" });
    }
  });

  /**
   * Serve uploaded objects.
   *
   * GET /objects/:objectPath(*)
   *
   * This serves files from object storage. For public files, no auth needed.
   * For protected files, add authentication middleware and ACL checks.
   */
  app.get("/objects/*objectPath", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

