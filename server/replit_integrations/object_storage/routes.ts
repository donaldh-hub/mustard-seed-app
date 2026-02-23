import express, { type Express } from "express";
import sharp from "sharp";
import { ObjectStorageService, ObjectNotFoundError, objectStorageClient } from "./objectStorage";
import { randomUUID } from "crypto";

const MAX_UPLOAD_DIMENSION = 1280;
const TARGET_COMPRESSED_BYTES = 900 * 1024;

async function compressWithSharp(buffer: Buffer, mimetype: string): Promise<{ data: Buffer; contentType: string }> {
  const originalSize = buffer.length;
  let pipeline = sharp(buffer).rotate();

  const metadata = await pipeline.metadata();
  const { width, height } = metadata;
  const origDims = `${width || 0}x${height || 0}`;

  if (width && height && (width > MAX_UPLOAD_DIMENSION || height > MAX_UPLOAD_DIMENSION)) {
    pipeline = pipeline.resize(MAX_UPLOAD_DIMENSION, MAX_UPLOAD_DIMENSION, { fit: "inside", withoutEnlargement: true });
  }

  pipeline = pipeline.jpeg({ quality: 75, mozjpeg: true });
  let result = await pipeline.toBuffer();

  if (result.length > TARGET_COMPRESSED_BYTES) {
    result = await sharp(buffer)
      .rotate()
      .resize(MAX_UPLOAD_DIMENSION, MAX_UPLOAD_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 55, mozjpeg: true })
      .toBuffer();
  }

  if (result.length > TARGET_COMPRESSED_BYTES) {
    result = await sharp(buffer)
      .rotate()
      .resize(960, 960, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 45, mozjpeg: true })
      .toBuffer();
  }

  const finalMeta = await sharp(result).metadata();
  console.log(`[sharp] original=${(originalSize / 1024).toFixed(0)}KB (${origDims}) → compressed=${(result.length / 1024).toFixed(0)}KB (${finalMeta.width}x${finalMeta.height})`);

  return { data: result, contentType: "image/jpeg" };
}

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

  const MAX_PENDING_UPLOADS = 10;
  const MAX_TOTAL_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_CHUNKS_PER_UPLOAD = 12;

  const pendingChunks = new Map<string, { chunks: Map<number, Buffer>; totalChunks: number; totalReceived: number; originalName: string; contentType: string; createdAt: number }>();

  setInterval(() => {
    const now = Date.now();
    const ids = Array.from(pendingChunks.keys());
    for (const id of ids) {
      const data = pendingChunks.get(id);
      if (data && now - data.createdAt > 5 * 60 * 1000) pendingChunks.delete(id);
    }
  }, 60000);

  const chunkParser = express.raw({ type: ["image/*", "application/octet-stream"], limit: "2mb" });

  app.post("/api/uploads/chunk", chunkParser, async (req, res) => {
    const uploadId = req.get("x-upload-id") || "";
    const chunkIndex = parseInt(req.get("x-chunk-index") || "0", 10);
    const totalChunks = parseInt(req.get("x-total-chunks") || "1", 10);
    const originalName = req.get("x-original-name") || "upload.jpg";
    const contentType = req.get("x-content-type") || "image/jpeg";

    try {
      const chunkBuffer = req.body as Buffer;
      if (!chunkBuffer || chunkBuffer.length === 0) {
        return res.status(400).json({ ok: false, error: "Empty chunk" });
      }

      if (!uploadId) {
        return res.status(400).json({ ok: false, error: "Missing upload ID" });
      }

      if (totalChunks > MAX_CHUNKS_PER_UPLOAD) {
        return res.status(400).json({ ok: false, error: `Too many chunks (max ${MAX_CHUNKS_PER_UPLOAD})` });
      }

      if (chunkIndex < 0 || chunkIndex >= totalChunks) {
        return res.status(400).json({ ok: false, error: "Invalid chunk index" });
      }

      if (!pendingChunks.has(uploadId) && pendingChunks.size >= MAX_PENDING_UPLOADS) {
        return res.status(429).json({ ok: false, error: "Too many pending uploads" });
      }

      console.log(`[CHUNK] id=${uploadId} chunk=${chunkIndex + 1}/${totalChunks} size=${chunkBuffer.length}`);

      if (!pendingChunks.has(uploadId)) {
        pendingChunks.set(uploadId, { chunks: new Map(), totalChunks, totalReceived: 0, originalName, contentType, createdAt: Date.now() });
      }

      const upload = pendingChunks.get(uploadId)!;
      upload.totalReceived += chunkBuffer.length;

      if (upload.totalReceived > MAX_TOTAL_FILE_SIZE) {
        pendingChunks.delete(uploadId);
        return res.status(413).json({ ok: false, error: "Total upload too large" });
      }

      upload.chunks.set(chunkIndex, chunkBuffer);

      if (upload.chunks.size < totalChunks) {
        return res.json({ ok: true, complete: false, received: upload.chunks.size, total: totalChunks });
      }

      const sortedChunks: Buffer[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const chunk = upload.chunks.get(i);
        if (!chunk) {
          pendingChunks.delete(uploadId);
          return res.status(400).json({ ok: false, error: `Missing chunk ${i}` });
        }
        sortedChunks.push(chunk);
      }
      const fullBuffer = Buffer.concat(sortedChunks);
      pendingChunks.delete(uploadId);

      console.log(`[CHUNK] Assembled: ${(fullBuffer.length / 1024).toFixed(0)}KB from ${totalChunks} chunks`);

      let uploadBuffer: Buffer;
      let uploadContentType: string;

      try {
        console.log(`[CHUNK] Compressing with sharp: ${(fullBuffer.length / 1024).toFixed(0)}KB`);
        const compressed = await compressWithSharp(fullBuffer, contentType);
        uploadBuffer = compressed.data;
        uploadContentType = compressed.contentType;
        console.log(`[CHUNK] Compressed: ${(fullBuffer.length / 1024).toFixed(0)}KB -> ${(uploadBuffer.length / 1024).toFixed(0)}KB`);
      } catch (compErr: any) {
        console.error(`[CHUNK] Sharp compression failed: ${compErr.message}. Rejecting upload.`);
        return res.status(422).json({ ok: false, error: "Server could not process this image format. Please try a different photo." });
      }

      const privateDir = objectStorageService.getPrivateObjectDir();
      const objectId = randomUUID();
      const fullPath = `${privateDir}/uploads/${objectId}`;
      const pathParts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
      const bucket = objectStorageClient.bucket(pathParts[0]);
      const gcsFile = bucket.file(pathParts.slice(1).join("/"));

      await new Promise<void>((resolve, reject) => {
        const stream = gcsFile.createWriteStream({ resumable: false, contentType: uploadContentType, metadata: { contentType: uploadContentType } });
        stream.on("error", (err) => reject(err));
        stream.on("finish", () => resolve());
        stream.end(uploadBuffer);
      });

      const objectPath = `/objects/uploads/${objectId}`;
      console.log(`[CHUNK] OK: ${objectPath} original=${fullBuffer.length} stored=${uploadBuffer.length}`);

      res.json({ ok: true, complete: true, objectPath, contentType: uploadContentType, size: uploadBuffer.length });
    } catch (err: any) {
      console.error(`[CHUNK] ERROR: ${err?.message || err}`);
      pendingChunks.delete(uploadId);
      res.status(500).json({ ok: false, error: "Chunk upload failed" });
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

