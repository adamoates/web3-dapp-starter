const Minio = require("minio");
const crypto = require("crypto");
const path = require("path");

class MinIOService {
  constructor() {
    this.client = null;
    this.buckets = {
      avatars: process.env.MINIO_AVATARS_BUCKET || "user-avatars",
      documents: process.env.MINIO_DOCUMENTS_BUCKET || "user-documents",
      nftAssets: process.env.MINIO_NFT_BUCKET || "nft-assets",
      temp: process.env.MINIO_TEMP_BUCKET || "temp-uploads"
    };
  }

  getClient() {
    if (!this.client) {
      this.client = new Minio.Client({
        endPoint: process.env.MINIO_ENDPOINT || "minio",
        port: parseInt(process.env.MINIO_PORT) || 9000,
        useSSL: process.env.MINIO_USE_SSL === "true",
        accessKey: process.env.MINIO_ROOT_USER || "minio",
        secretKey: process.env.MINIO_ROOT_PASSWORD || "minio123"
      });
    }
    return this.client;
  }

  async init() {
    try {
      const client = this.getClient();
      // Ensure all buckets exist
      for (const [name, bucket] of Object.entries(this.buckets)) {
        const exists = await client.bucketExists(bucket);
        if (!exists) {
          await client.makeBucket(bucket);
          console.log(`✅ Created MinIO bucket: ${bucket}`);
        }
      }

      // Set bucket policies for public access where needed
      await this.setPublicReadPolicy(this.buckets.avatars);
      await this.setPublicReadPolicy(this.buckets.nftAssets);

      console.log("✅ MinIO initialized successfully");
    } catch (error) {
      console.error("❌ MinIO initialization failed:", error);
      throw error;
    }
  }

  async setPublicReadPolicy(bucketName) {
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${bucketName}/*`]
        }
      ]
    };

    try {
      const client = this.getClient();
      await client.setBucketPolicy(bucketName, JSON.stringify(policy));
    } catch (error) {
      console.warn(
        `Warning: Could not set public policy for ${bucketName}:`,
        error.message
      );
    }
  }

  generateFileName(originalName, userId, prefix = "") {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString("hex");
    return `${prefix}${userId}/${timestamp}-${random}${ext}`;
  }

  async uploadFile(bucket, file, userId, metadata = {}) {
    const fileName = this.generateFileName(file.originalname, userId);

    const uploadMetadata = {
      "Content-Type": file.mimetype,
      "X-User-Id": userId.toString(),
      "X-Upload-Date": new Date().toISOString(),
      ...metadata
    };

    try {
      const client = this.getClient();
      const result = await client.putObject(
        bucket,
        fileName,
        file.buffer,
        file.size,
        uploadMetadata
      );

      return {
        fileName,
        url: await this.getFileUrl(bucket, fileName),
        size: file.size,
        mimetype: file.mimetype,
        etag: result.etag
      };
    } catch (error) {
      console.error("MinIO upload error:", error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  async getFileUrl(bucket, fileName, expiry = 7 * 24 * 60 * 60) {
    try {
      // For public buckets, return direct URL
      if (
        bucket === this.buckets.avatars ||
        bucket === this.buckets.nftAssets
      ) {
        return `http://${process.env.MINIO_ENDPOINT || "localhost"}:${
          process.env.MINIO_PORT || 9000
        }/${bucket}/${fileName}`;
      }

      // For private buckets, return presigned URL
      const client = this.getClient();
      return await client.presignedGetObject(bucket, fileName, expiry);
    } catch (error) {
      console.error("MinIO URL generation error:", error);
      throw error;
    }
  }

  async deleteFile(bucket, fileName) {
    try {
      const client = this.getClient();
      await client.removeObject(bucket, fileName);
      return true;
    } catch (error) {
      console.error("MinIO delete error:", error);
      throw error;
    }
  }

  async listUserFiles(bucket, userId, prefix = "") {
    const userPrefix = `${prefix}${userId}/`;
    const files = [];

    try {
      const client = this.getClient();
      const stream = client.listObjects(bucket, userPrefix, true);

      for await (const obj of stream) {
        files.push({
          name: obj.name,
          size: obj.size,
          lastModified: obj.lastModified,
          url: await this.getFileUrl(bucket, obj.name)
        });
      }

      return files;
    } catch (error) {
      console.error("MinIO list error:", error);
      throw error;
    }
  }

  async getFileStats(bucket, fileName) {
    try {
      const client = this.getClient();
      return await client.statObject(bucket, fileName);
    } catch (error) {
      console.error("MinIO stat error:", error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      const client = this.getClient();
      await client.listBuckets();
      return { status: "healthy", timestamp: new Date().toISOString() };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Additional utility methods
  async copyFile(sourceBucket, sourceFile, destBucket, destFile) {
    try {
      const client = this.getClient();
      await client.copyObject(
        destBucket,
        destFile,
        `${sourceBucket}/${sourceFile}`
      );
      return true;
    } catch (error) {
      console.error("MinIO copy error:", error);
      throw error;
    }
  }

  async moveFile(sourceBucket, sourceFile, destBucket, destFile) {
    try {
      await this.copyFile(sourceBucket, sourceFile, destBucket, destFile);
      await this.deleteFile(sourceBucket, sourceFile);
      return true;
    } catch (error) {
      console.error("MinIO move error:", error);
      throw error;
    }
  }

  async getBucketSize(bucketName) {
    try {
      let totalSize = 0;
      const stream = this.client.listObjects(bucketName, "", true);

      for await (const obj of stream) {
        totalSize += obj.size;
      }

      return totalSize;
    } catch (error) {
      console.error("MinIO bucket size error:", error);
      throw error;
    }
  }

  async cleanupTempFiles(olderThanHours = 24) {
    try {
      const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
      const tempFiles = await this.listUserFiles(this.buckets.temp, "");

      for (const file of tempFiles) {
        if (file.lastModified < cutoffTime) {
          await this.deleteFile(this.buckets.temp, file.name);
        }
      }

      return tempFiles.length;
    } catch (error) {
      console.error("MinIO cleanup error:", error);
      throw error;
    }
  }
}

module.exports = MinIOService;
