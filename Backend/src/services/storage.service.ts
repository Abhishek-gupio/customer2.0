import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs/promises";
import path from "path";
import { s3Client } from "../config/aws";
import { env } from "../config/env";
import { logger } from "../config/logger";

export const storageService = {
  async uploadFile(
    file: Express.Multer.File,
    folder: string,
    isPublic = false,
  ): Promise<{ url: string; key: string }> {
    const key = `${folder}/${Date.now()}-${file.originalname}`;

    if (env.STORAGE_DRIVER === "s3") {
      const bucket = env.AWS_S3_BUCKET;
      if (!bucket) {
        logger.warn(
          "AWS_S3_BUCKET not set while S3 driver chosen. Falling back to local.",
        );
      } else {
        try {
          await s3Client.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: key,
              Body: file.buffer,
              ContentType: file.mimetype,
            }),
          );
          const url = `https://${bucket}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
          return { url, key };
        } catch (error) {
          logger.error({ error, key }, "Failed to upload file to S3");
          throw error;
        }
      }
    }

    // Local Storage fallback
    const uploadDir = path.join(process.cwd(), env.UPLOAD_DIR, folder);
    await fs.mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, `${Date.now()}-${file.originalname}`);
    await fs.writeFile(filePath, file.buffer);

    // The key here is the relative path from the upload root
    const relativeKey = path.relative(
      path.join(process.cwd(), env.UPLOAD_DIR),
      filePath,
    );
    let url = `/uploads/${relativeKey}`;
    if (env.PUBLIC_BASE_URL) {
      url = `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}${url}`;
    }
    return { url, key: relativeKey };
  },

  async getSignedUrl(key: string, expiresIn = 3600, disposition?: string): Promise<string> {
    if (env.STORAGE_DRIVER === "s3" && env.AWS_S3_BUCKET) {
      try {
        const command = new GetObjectCommand({
          Bucket: env.AWS_S3_BUCKET,
          Key: key,
          ResponseContentDisposition: disposition,
        });
        return await getSignedUrl(s3Client, command, { expiresIn });
      } catch (error) {
        logger.error({ error, key }, "Failed to generate signed URL");
        throw error;
      }
    }

    // Local URLs are stable
    return key.startsWith("http") ? key : `/uploads/${key}`;
  },

  /**
   * For S3: return a presigned URL so the object can be read without public ACL.
   * For local or non-S3 URLs: return as-is.
   */
  async ensureReadableUrl(urlOrKey: string, expiresIn = 86400, disposition?: string): Promise<string> {
    if (!urlOrKey || !urlOrKey.trim()) return urlOrKey;
    const trimmed = urlOrKey.trim();
    // Check if it's our S3 URL (direct object URL)
    const bucket = env.AWS_S3_BUCKET;
    const region = env.AWS_REGION;
    if (
      bucket &&
      region &&
      (trimmed.startsWith(`https://${bucket}.s3.`) || trimmed.startsWith(`https://s3.${region}.amazonaws.com/${bucket}/`))
    ) {
      try {
        const parsed = new URL(trimmed);
        let key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
        // Format s3.region.amazonaws.com/bucket/key → key is path without leading bucket segment
        if (key.startsWith(`${bucket}/`)) key = key.slice(bucket.length + 1);
        return await this.getSignedUrl(key, expiresIn, disposition);
      } catch {
        // If it was a URL but couldn't be parsed or signed, returning original
        return trimmed;
      }
    }

    // For any other case where it's not a full URL, treat it as a key (S3 or local)
    if (!trimmed.startsWith("http")) {
      try {
        return await this.getSignedUrl(trimmed, expiresIn, disposition);
      } catch (error) {
        logger.warn({ error, urlOrKey: trimmed }, "Failed to get readable URL for key");
        return trimmed;
      }
    }

    return trimmed;
  },

  async deleteFile(urlOrKey: string): Promise<void> {
    if (!urlOrKey) return;

    let key = urlOrKey.trim();

    if (key.startsWith("/uploads/")) {
      key = key.replace(/^\/uploads\//, "");
    } else if (key.startsWith("http://") || key.startsWith("https://")) {
      try {
        const parsed = new URL(key);
        key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
      } catch {
        logger.warn({ urlOrKey }, "Failed to parse storage URL for deletion");
        return;
      }
    }

    key = key.replace(/^uploads\//, "");

    if (!key) return;

    if (env.STORAGE_DRIVER === "s3" && env.AWS_S3_BUCKET) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: env.AWS_S3_BUCKET,
            Key: key,
          }),
        );
        return;
      } catch (error) {
        logger.error({ error, key }, "Failed to delete file from S3");
        throw error;
      }
    }

    try {
      const uploadRoot = path.join(process.cwd(), env.UPLOAD_DIR);
      const filePath = path.join(uploadRoot, key);
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error?.code === "ENOENT") return;
      logger.error({ error, key }, "Failed to delete local file");
      throw error;
    }
  },
};
