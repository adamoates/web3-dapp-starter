const express = require("express");
const {
  createUploadMiddleware,
  authenticateToken
} = require("../middleware/upload");
const MinIOService = require("../services/MinIOService");
const UserActivity = require("../models/nosql/UserActivity");

const createFileRouter = (databases) => {
  const router = express.Router();
  const minioService = new MinIOService();
  const uploadMiddleware = createUploadMiddleware(databases.postgresPool);

  // Initialize MinIO on router creation (skip during tests)
  if (process.env.NODE_ENV !== "test") {
    minioService.init().catch(console.error);
  }

  // Upload user avatar
  router.post("/avatar", uploadMiddleware, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      // Delete old avatar if exists
      const oldAvatarQuery = await databases.postgresPool.query(
        "SELECT avatar_url FROM users WHERE id = $1",
        [req.user.id]
      );

      if (oldAvatarQuery.rows[0]?.avatar_url) {
        const oldFileName = oldAvatarQuery.rows[0].avatar_url.split("/").pop();
        await minioService
          .deleteFile(
            minioService.buckets.avatars,
            `avatars/${req.user.id}/${oldFileName}`
          )
          .catch(console.warn);
      }

      // Upload new avatar
      const result = await minioService.uploadFile(
        minioService.buckets.avatars,
        req.file,
        req.user.id,
        { "X-File-Type": "avatar" }
      );

      // Update user record with new avatar URL
      await databases.postgresPool.query(
        "UPDATE users SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [result.url, req.user.id]
      );

      // Log activity in MongoDB
      const activity = new UserActivity({
        userId: req.user.id,
        action: "avatar_uploaded",
        details: {
          fileName: result.fileName,
          fileSize: result.size,
          mimeType: result.mimetype
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent")
      });
      await activity.save();

      // Update Redis cache
      const profileKey = `user_profile:${req.user.id}`;
      const cachedProfile = await databases.redisClient.get(profileKey);
      if (cachedProfile) {
        const profile = JSON.parse(cachedProfile);
        profile.avatarUrl = result.url;
        await databases.redisClient.setex(
          profileKey,
          1800,
          JSON.stringify(profile)
        );
      }

      res.json({
        message: "Avatar uploaded successfully",
        file: result
      });
    } catch (error) {
      console.error("Avatar upload error:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // Upload document
  router.post("/document", uploadMiddleware, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const result = await minioService.uploadFile(
        minioService.buckets.documents,
        req.file,
        req.user.id,
        {
          "X-File-Type": "document",
          "X-Description": req.body.description || ""
        }
      );

      // Store file metadata in PostgreSQL
      const fileResult = await databases.postgresPool.query(
        `
        INSERT INTO user_files (user_id, filename, original_name, file_url, file_size, mime_type, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, filename, original_name, file_url, file_size, mime_type, description, created_at
      `,
        [
          req.user.id,
          result.fileName,
          req.file.originalname,
          result.url,
          result.size,
          result.mimetype,
          req.body.description || null
        ]
      );

      // Log activity in MongoDB
      const activity = new UserActivity({
        userId: req.user.id,
        action: "document_uploaded",
        details: {
          fileId: fileResult.rows[0].id,
          fileName: result.fileName,
          originalName: req.file.originalname,
          fileSize: result.size,
          mimeType: result.mimetype,
          description: req.body.description
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent")
      });
      await activity.save();

      res.json({
        message: "Document uploaded successfully",
        file: {
          ...result,
          id: fileResult.rows[0].id,
          originalName: fileResult.rows[0].original_name,
          description: fileResult.rows[0].description,
          createdAt: fileResult.rows[0].created_at
        }
      });
    } catch (error) {
      console.error("Document upload error:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // Upload NFT asset
  router.post("/nft-asset", uploadMiddleware, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const result = await minioService.uploadFile(
        minioService.buckets.nftAssets,
        req.file,
        req.user.id,
        {
          "X-File-Type": "nft-asset",
          "X-Token-Id": req.body.tokenId || "",
          "X-Contract-Address": req.body.contractAddress || ""
        }
      );

      // Log activity in MongoDB
      const activity = new UserActivity({
        userId: req.user.id,
        action: "nft_asset_uploaded",
        details: {
          fileName: result.fileName,
          fileSize: result.size,
          mimeType: result.mimetype,
          tokenId: req.body.tokenId,
          contractAddress: req.body.contractAddress
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent")
      });
      await activity.save();

      res.json({
        message: "NFT asset uploaded successfully",
        file: result
      });
    } catch (error) {
      console.error("NFT asset upload error:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // Get user files
  router.get(
    "/my-files",
    authenticateToken(databases.postgresPool),
    async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const result = await databases.postgresPool.query(
          `
        SELECT id, filename, original_name, file_url, file_size, mime_type, description, created_at
        FROM user_files 
        WHERE user_id = $1 
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
          [req.user.id, limit, offset]
        );

        // Get total count
        const countResult = await databases.postgresPool.query(
          "SELECT COUNT(*) as total FROM user_files WHERE user_id = $1",
          [req.user.id]
        );

        res.json({
          files: result.rows,
          pagination: {
            limit,
            offset,
            total: parseInt(countResult.rows[0].total),
            hasMore: offset + limit < parseInt(countResult.rows[0].total)
          }
        });
      } catch (error) {
        console.error("Get files error:", error);
        res.status(500).json({ error: "Failed to retrieve files" });
      }
    }
  );

  // Get file by ID
  router.get(
    "/file/:fileId",
    authenticateToken(databases.postgresPool),
    async (req, res) => {
      try {
        const { fileId } = req.params;

        const result = await databases.postgresPool.query(
          `
        SELECT id, filename, original_name, file_url, file_size, mime_type, description, created_at
        FROM user_files 
        WHERE id = $1 AND user_id = $2
      `,
          [fileId, req.user.id]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: "File not found" });
        }

        res.json({ file: result.rows[0] });
      } catch (error) {
        console.error("Get file error:", error);
        res.status(500).json({ error: "Failed to retrieve file" });
      }
    }
  );

  // Delete file
  router.delete(
    "/file/:fileId",
    authenticateToken(databases.postgresPool),
    async (req, res) => {
      try {
        const { fileId } = req.params;

        // Verify file belongs to user
        const fileResult = await databases.postgresPool.query(
          "SELECT * FROM user_files WHERE id = $1 AND user_id = $2",
          [fileId, req.user.id]
        );

        if (fileResult.rows.length === 0) {
          return res.status(404).json({ error: "File not found" });
        }

        const file = fileResult.rows[0];

        // Delete from MinIO
        await minioService.deleteFile(
          minioService.buckets.documents,
          file.filename
        );

        // Delete from database
        await databases.postgresPool.query(
          "DELETE FROM user_files WHERE id = $1 AND user_id = $2",
          [fileId, req.user.id]
        );

        // Log activity in MongoDB
        const activity = new UserActivity({
          userId: req.user.id,
          action: "file_deleted",
          details: {
            fileId: parseInt(fileId),
            fileName: file.filename,
            originalName: file.original_name
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent")
        });
        await activity.save();

        res.json({ message: "File deleted successfully" });
      } catch (error) {
        console.error("Delete file error:", error);
        res.status(500).json({ error: "Failed to delete file" });
      }
    }
  );

  // Get file download URL
  router.get(
    "/download/:fileId",
    authenticateToken(databases.postgresPool),
    async (req, res) => {
      try {
        const { fileId } = req.params;

        // Verify file belongs to user
        const fileResult = await databases.postgresPool.query(
          "SELECT * FROM user_files WHERE id = $1 AND user_id = $2",
          [fileId, req.user.id]
        );

        if (fileResult.rows.length === 0) {
          return res.status(404).json({ error: "File not found" });
        }

        const file = fileResult.rows[0];
        const downloadUrl = await minioService.getFileUrl(
          minioService.buckets.documents,
          file.filename,
          3600
        ); // 1 hour expiry

        // Log download activity
        const activity = new UserActivity({
          userId: req.user.id,
          action: "file_downloaded",
          details: {
            fileId: parseInt(fileId),
            fileName: file.filename,
            originalName: file.original_name
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent")
        });
        await activity.save();

        res.json({
          downloadUrl,
          filename: file.original_name,
          expires: new Date(Date.now() + 3600000).toISOString()
        });
      } catch (error) {
        console.error("Download URL error:", error);
        res.status(500).json({ error: "Failed to generate download URL" });
      }
    }
  );

  // Update file description
  router.put(
    "/file/:fileId/description",
    authenticateToken(databases.postgresPool),
    async (req, res) => {
      try {
        const { fileId } = req.params;
        const { description } = req.body;

        if (!description) {
          return res.status(400).json({ error: "Description is required" });
        }

        const result = await databases.postgresPool.query(
          `
        UPDATE user_files 
        SET description = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND user_id = $3
        RETURNING id, filename, original_name, description, updated_at
      `,
          [description, fileId, req.user.id]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: "File not found" });
        }

        res.json({
          message: "File description updated successfully",
          file: result.rows[0]
        });
      } catch (error) {
        console.error("Update description error:", error);
        res.status(500).json({ error: "Failed to update description" });
      }
    }
  );

  // Get file statistics
  router.get(
    "/stats",
    authenticateToken(databases.postgresPool),
    async (req, res) => {
      try {
        // Get file count and total size
        const statsResult = await databases.postgresPool.query(
          `
        SELECT 
          COUNT(*) as total_files,
          SUM(file_size) as total_size,
          COUNT(CASE WHEN mime_type LIKE 'image/%' THEN 1 END) as image_files,
          COUNT(CASE WHEN mime_type LIKE 'application/%' THEN 1 END) as document_files
        FROM user_files 
        WHERE user_id = $1
      `,
          [req.user.id]
        );

        // Get recent uploads
        const recentResult = await databases.postgresPool.query(
          `
        SELECT original_name, file_size, created_at
        FROM user_files 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT 5
      `,
          [req.user.id]
        );

        res.json({
          stats: {
            totalFiles: parseInt(statsResult.rows[0].total_files),
            totalSize: parseInt(statsResult.rows[0].total_size) || 0,
            imageFiles: parseInt(statsResult.rows[0].image_files),
            documentFiles: parseInt(statsResult.rows[0].document_files)
          },
          recentUploads: recentResult.rows
        });
      } catch (error) {
        console.error("Get stats error:", error);
        res.status(500).json({ error: "Failed to get file statistics" });
      }
    }
  );

  // Search files
  router.get(
    "/search",
    authenticateToken(databases.postgresPool),
    async (req, res) => {
      try {
        const { q: query, type: fileType } = req.query;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        let sql = `
        SELECT id, filename, original_name, file_url, file_size, mime_type, description, created_at
        FROM user_files 
        WHERE user_id = $1
      `;
        const params = [req.user.id];
        let paramCount = 1;

        if (query) {
          paramCount++;
          sql += ` AND (original_name ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
          params.push(`%${query}%`);
        }

        if (fileType) {
          paramCount++;
          if (fileType === "image") {
            sql += ` AND mime_type LIKE 'image/%'`;
          } else if (fileType === "document") {
            sql += ` AND mime_type LIKE 'application/%'`;
          }
        }

        sql += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${
          paramCount + 2
        }`;
        params.push(limit, offset);

        const result = await databases.postgresPool.query(sql, params);

        res.json({
          files: result.rows,
          pagination: {
            limit,
            offset,
            total: result.rows.length,
            hasMore: result.rows.length === limit
          }
        });
      } catch (error) {
        console.error("Search files error:", error);
        res.status(500).json({ error: "Failed to search files" });
      }
    }
  );

  return router;
};

module.exports = createFileRouter;
