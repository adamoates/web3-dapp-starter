const request = require("supertest");
const { app, dbManager } = require("../../src/index");
const MinIOService = require("../../src/services/MinIOService");

describe("MinIO File Management Integration Tests", () => {
  let testUser;
  let authToken;
  let minioService;

  beforeAll(async () => {
    // Ensure databases are connected
    await dbManager.connect();

    // Initialize MinIO service
    minioService = new MinIOService();
    await minioService.init();
  });

  afterAll(async () => {
    // Clean up and disconnect
    await dbManager.disconnect();
  });

  beforeEach(async () => {
    // Create test user
    const userData = {
      email: "filetest@example.com",
      password: "password123",
      name: "File Test User"
    };

    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send(userData);

    testUser = registerResponse.body.user;

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: userData.email,
      password: userData.password
    });

    authToken = loginResponse.body.token;
  });

  describe("MinIO Service Health", () => {
    test("should check MinIO health status", async () => {
      const health = await minioService.healthCheck();
      expect(health.status).toBe("healthy");
      expect(health.timestamp).toBeDefined();
    });

    test("should generate unique file names", () => {
      const fileName1 = minioService.generateFileName("test.jpg", 123);
      const fileName2 = minioService.generateFileName("test.jpg", 123);

      expect(fileName1).not.toBe(fileName2);
      expect(fileName1).toMatch(/^123\/\d+-[a-f0-9]+\.jpg$/);
      expect(fileName2).toMatch(/^123\/\d+-[a-f0-9]+\.jpg$/);
    });
  });

  describe("Avatar Upload", () => {
    test("should upload avatar successfully", async () => {
      const imageBuffer = Buffer.from("fake-image-data");

      const response = await request(app)
        .post("/api/files/avatar")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", imageBuffer, {
          filename: "avatar.jpg",
          contentType: "image/jpeg"
        })
        .expect(200);

      expect(response.body).toHaveProperty(
        "message",
        "Avatar uploaded successfully"
      );
      expect(response.body.file).toHaveProperty("url");
      expect(response.body.file).toHaveProperty("fileName");
      expect(response.body.file).toHaveProperty("size");
      expect(response.body.file).toHaveProperty("mimetype", "image/jpeg");
    });

    test("should reject invalid file types for avatar", async () => {
      const textBuffer = Buffer.from("not-an-image");

      const response = await request(app)
        .post("/api/files/avatar")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", textBuffer, {
          filename: "document.txt",
          contentType: "text/plain"
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Invalid file type");
    });

    test("should require authentication for avatar upload", async () => {
      const imageBuffer = Buffer.from("fake-image-data");

      await request(app)
        .post("/api/files/avatar")
        .attach("file", imageBuffer, {
          filename: "avatar.jpg",
          contentType: "image/jpeg"
        })
        .expect(401);
    });

    test("should replace old avatar when uploading new one", async () => {
      // Upload first avatar
      const imageBuffer1 = Buffer.from("first-avatar-data");
      await request(app)
        .post("/api/files/avatar")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", imageBuffer1, {
          filename: "avatar1.jpg",
          contentType: "image/jpeg"
        })
        .expect(200);

      // Upload second avatar
      const imageBuffer2 = Buffer.from("second-avatar-data");
      const response = await request(app)
        .post("/api/files/avatar")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", imageBuffer2, {
          filename: "avatar2.jpg",
          contentType: "image/jpeg"
        })
        .expect(200);

      expect(response.body).toHaveProperty(
        "message",
        "Avatar uploaded successfully"
      );
    });
  });

  describe("Document Upload", () => {
    test("should upload document successfully", async () => {
      const docBuffer = Buffer.from('{"test": "document content"}');

      const response = await request(app)
        .post("/api/files/document")
        .set("Authorization", `Bearer ${authToken}`)
        .field("description", "Test document for integration testing")
        .attach("file", docBuffer, {
          filename: "test.json",
          contentType: "application/json"
        })
        .expect(200);

      expect(response.body).toHaveProperty(
        "message",
        "Document uploaded successfully"
      );
      expect(response.body.file).toHaveProperty("url");
      expect(response.body.file).toHaveProperty("id");
      expect(response.body.file).toHaveProperty("originalName", "test.json");
      expect(response.body.file).toHaveProperty(
        "description",
        "Test document for integration testing"
      );
      expect(response.body.file).toHaveProperty("createdAt");
    });

    test("should store file metadata in database", async () => {
      const docBuffer = Buffer.from("test document content");

      await request(app)
        .post("/api/files/document")
        .set("Authorization", `Bearer ${authToken}`)
        .field("description", "Test document")
        .attach("file", docBuffer, {
          filename: "test.txt",
          contentType: "text/plain"
        })
        .expect(200);

      // Check if file metadata was stored
      const filesResponse = await request(app)
        .get("/api/files/my-files")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(filesResponse.body.files).toHaveLength(1);
      expect(filesResponse.body.files[0]).toHaveProperty(
        "original_name",
        "test.txt"
      );
      expect(filesResponse.body.files[0]).toHaveProperty(
        "description",
        "Test document"
      );
      expect(filesResponse.body.files[0]).toHaveProperty(
        "mime_type",
        "text/plain"
      );
    });

    test("should reject oversized files", async () => {
      // Create a buffer larger than 10MB
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024, "x");

      const response = await request(app)
        .post("/api/files/document")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", largeBuffer, {
          filename: "large.txt",
          contentType: "text/plain"
        })
        .expect(400);

      expect(response.body).toHaveProperty(
        "error",
        "File too large (max 10MB)"
      );
    });
  });

  describe("NFT Asset Upload", () => {
    test("should upload NFT asset successfully", async () => {
      const nftBuffer = Buffer.from("fake-nft-image-data");

      const response = await request(app)
        .post("/api/files/nft-asset")
        .set("Authorization", `Bearer ${authToken}`)
        .field("tokenId", "123")
        .field("contractAddress", "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6")
        .attach("file", nftBuffer, {
          filename: "nft.png",
          contentType: "image/png"
        })
        .expect(200);

      expect(response.body).toHaveProperty(
        "message",
        "NFT asset uploaded successfully"
      );
      expect(response.body.file).toHaveProperty("url");
      expect(response.body.file).toHaveProperty("fileName");
    });
  });

  describe("File Management", () => {
    let uploadedFile;

    beforeEach(async () => {
      // Upload a test document
      const docBuffer = Buffer.from("test content for file management");

      const response = await request(app)
        .post("/api/files/document")
        .set("Authorization", `Bearer ${authToken}`)
        .field("description", "Test file for management")
        .attach("file", docBuffer, {
          filename: "management-test.txt",
          contentType: "text/plain"
        });

      uploadedFile = response.body.file;
    });

    test("should list user files with pagination", async () => {
      const response = await request(app)
        .get("/api/files/my-files?limit=10&offset=0")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.files).toHaveLength(1);
      expect(response.body.files[0]).toHaveProperty(
        "original_name",
        "management-test.txt"
      );
      expect(response.body.pagination).toHaveProperty("limit", 10);
      expect(response.body.pagination).toHaveProperty("offset", 0);
      expect(response.body.pagination).toHaveProperty("total", 1);
      expect(response.body.pagination).toHaveProperty("hasMore", false);
    });

    test("should get file by ID", async () => {
      const response = await request(app)
        .get(`/api/files/file/${uploadedFile.id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.file).toHaveProperty("id", uploadedFile.id);
      expect(response.body.file).toHaveProperty(
        "original_name",
        "management-test.txt"
      );
      expect(response.body.file).toHaveProperty(
        "description",
        "Test file for management"
      );
    });

    test("should generate download URL", async () => {
      const response = await request(app)
        .get(`/api/files/download/${uploadedFile.id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("downloadUrl");
      expect(response.body).toHaveProperty("filename", "management-test.txt");
      expect(response.body).toHaveProperty("expires");
    });

    test("should update file description", async () => {
      const newDescription = "Updated description for test file";

      const response = await request(app)
        .put(`/api/files/file/${uploadedFile.id}/description`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ description: newDescription })
        .expect(200);

      expect(response.body).toHaveProperty(
        "message",
        "File description updated successfully"
      );
      expect(response.body.file).toHaveProperty("description", newDescription);
    });

    test("should delete file successfully", async () => {
      await request(app)
        .delete(`/api/files/file/${uploadedFile.id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Verify file is deleted
      const filesResponse = await request(app)
        .get("/api/files/my-files")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(filesResponse.body.files).toHaveLength(0);
    });

    test("should not allow access to other users files", async () => {
      // Create another user
      const otherUserData = {
        email: "otheruser@example.com",
        password: "password123",
        name: "Other User"
      };

      const otherUserResponse = await request(app)
        .post("/api/auth/register")
        .send(otherUserData);

      const otherUserLoginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          email: otherUserData.email,
          password: otherUserData.password
        });

      const otherUserToken = otherUserLoginResponse.body.token;

      // Try to access first user's file
      await request(app)
        .get(`/api/files/file/${uploadedFile.id}`)
        .set("Authorization", `Bearer ${otherUserToken}`)
        .expect(404);
    });
  });

  describe("File Statistics", () => {
    beforeEach(async () => {
      // Upload multiple files for testing
      const files = [
        { content: "image data", filename: "test1.jpg", type: "image/jpeg" },
        {
          content: "document data",
          filename: "test2.pdf",
          type: "application/pdf"
        },
        { content: "text data", filename: "test3.txt", type: "text/plain" }
      ];

      for (const file of files) {
        await request(app)
          .post("/api/files/document")
          .set("Authorization", `Bearer ${authToken}`)
          .attach("file", Buffer.from(file.content), {
            filename: file.filename,
            contentType: file.type
          });
      }
    });

    test("should get file statistics", async () => {
      const response = await request(app)
        .get("/api/files/stats")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.stats).toHaveProperty("totalFiles");
      expect(response.body.stats).toHaveProperty("totalSize");
      expect(response.body.stats).toHaveProperty("imageFiles");
      expect(response.body.stats).toHaveProperty("documentFiles");
      expect(response.body).toHaveProperty("recentUploads");
      expect(Array.isArray(response.body.recentUploads)).toBe(true);
    });
  });

  describe("File Search", () => {
    beforeEach(async () => {
      // Upload files with different names and descriptions
      const files = [
        {
          content: "test content",
          filename: "important-document.pdf",
          description: "Very important document"
        },
        {
          content: "image data",
          filename: "vacation-photo.jpg",
          description: "Photo from vacation"
        },
        {
          content: "data content",
          filename: "report.txt",
          description: "Monthly report"
        }
      ];

      for (const file of files) {
        await request(app)
          .post("/api/files/document")
          .set("Authorization", `Bearer ${authToken}`)
          .field("description", file.description)
          .attach("file", Buffer.from(file.content), {
            filename: file.filename,
            contentType: file.filename.endsWith(".jpg")
              ? "image/jpeg"
              : "text/plain"
          });
      }
    });

    test("should search files by name", async () => {
      const response = await request(app)
        .get("/api/files/search?q=important")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.files).toHaveLength(1);
      expect(response.body.files[0].original_name).toBe(
        "important-document.pdf"
      );
    });

    test("should search files by description", async () => {
      const response = await request(app)
        .get("/api/files/search?q=vacation")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.files).toHaveLength(1);
      expect(response.body.files[0].original_name).toBe("vacation-photo.jpg");
    });

    test("should filter files by type", async () => {
      const response = await request(app)
        .get("/api/files/search?type=image")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.files.length).toBeGreaterThan(0);
      response.body.files.forEach((file) => {
        expect(file.mime_type).toMatch(/^image\//);
      });
    });

    test("should return pagination info", async () => {
      const response = await request(app)
        .get("/api/files/search?limit=2&offset=0")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination).toHaveProperty("limit", 2);
      expect(response.body.pagination).toHaveProperty("offset", 0);
      expect(response.body.pagination).toHaveProperty("total");
      expect(response.body.pagination).toHaveProperty("hasMore");
    });
  });

  describe("Error Handling", () => {
    test("should handle missing file in upload", async () => {
      const response = await request(app)
        .post("/api/files/document")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty("error", "No file provided");
    });

    test("should handle invalid file ID", async () => {
      await request(app)
        .get("/api/files/file/99999")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);
    });

    test("should handle missing description in update", async () => {
      const response = await request(app)
        .put("/api/files/file/1/description")
        .set("Authorization", `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("error", "Description is required");
    });

    test("should handle MinIO service errors gracefully", async () => {
      // This test would require mocking MinIO service to simulate errors
      // For now, we'll test the error handling middleware
      const response = await request(app)
        .get("/api/files/nonexistent-endpoint")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe("Activity Logging", () => {
    test("should log file upload activity", async () => {
      const docBuffer = Buffer.from("activity test content");

      await request(app)
        .post("/api/files/document")
        .set("Authorization", `Bearer ${authToken}`)
        .field("description", "Activity test file")
        .attach("file", docBuffer, {
          filename: "activity-test.txt",
          contentType: "text/plain"
        })
        .expect(200);

      // Check if activity was logged
      const activityResponse = await request(app)
        .get("/api/auth/activity")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const uploadActivity = activityResponse.body.activity.find(
        (activity) => activity.action === "document_uploaded"
      );

      expect(uploadActivity).toBeDefined();
      expect(uploadActivity.details).toHaveProperty(
        "originalName",
        "activity-test.txt"
      );
      expect(uploadActivity.details).toHaveProperty(
        "description",
        "Activity test file"
      );
    });

    test("should log file download activity", async () => {
      // First upload a file
      const docBuffer = Buffer.from("download test content");
      const uploadResponse = await request(app)
        .post("/api/files/document")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", docBuffer, {
          filename: "download-test.txt",
          contentType: "text/plain"
        });

      const fileId = uploadResponse.body.file.id;

      // Then download it
      await request(app)
        .get(`/api/files/download/${fileId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Check if download activity was logged
      const activityResponse = await request(app)
        .get("/api/auth/activity")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const downloadActivity = activityResponse.body.activity.find(
        (activity) => activity.action === "file_downloaded"
      );

      expect(downloadActivity).toBeDefined();
      expect(downloadActivity.details).toHaveProperty("fileId", fileId);
    });
  });
});
