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
    const url = `/uploads/${relativeKey}`; // This needs to be served by express

    return { url, key: relativeKey };
  },

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    if (env.STORAGE_DRIVER === "s3" && env.AWS_S3_BUCKET) {
      try {
        const command = new GetObjectCommand({
          Bucket: env.AWS_S3_BUCKET,
          Key: key,
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
