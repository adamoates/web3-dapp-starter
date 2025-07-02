const MinIOService = require("../../../src/services/MinIOService");

// Mock crypto module
jest.mock("crypto", () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => "abcdef1234567890")
  }))
}));

// Mock path module
jest.mock("path", () => ({
  extname: jest.fn((filename) => {
    const ext = filename.split(".").pop();
    return ext ? `.${ext}` : "";
  })
}));

// Mock MinIO client
const mockMinioClient = {
  bucketExists: jest.fn().mockResolvedValue(true),
  makeBucket: jest.fn().mockResolvedValue(),
  putObject: jest.fn().mockResolvedValue({ etag: "mock-etag" }),
  getObject: jest.fn().mockResolvedValue({ pipe: jest.fn() }),
  removeObject: jest.fn().mockResolvedValue(),
  listObjects: jest.fn().mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      yield {
        name: "1/1234567890-abcdef1234567890.jpg",
        size: 1024,
        lastModified: new Date()
      };
    }
  }),
  presignedGetObject: jest.fn().mockResolvedValue("https://presigned-url.com"),
  statObject: jest.fn().mockResolvedValue({
    size: 1024,
    lastModified: new Date(),
    etag: "mock-etag"
  }),
  setBucketPolicy: jest.fn().mockResolvedValue(),
  listBuckets: jest.fn().mockResolvedValue([])
};

jest.mock("minio", () => ({
  Client: jest.fn(() => mockMinioClient)
}));

describe("MinIOService", () => {
  let minioService;

  beforeEach(() => {
    jest.clearAllMocks();
    minioService = new MinIOService();
  });

  describe("initialization", () => {
    it("should initialize with default bucket names", () => {
      expect(minioService.buckets.avatars).toBe("user-avatars");
      expect(minioService.buckets.documents).toBe("user-documents");
      expect(minioService.buckets.nftAssets).toBe("nft-assets");
      expect(minioService.buckets.temp).toBe("temp-uploads");
    });

    it("should initialize with custom bucket names from environment", () => {
      process.env.MINIO_AVATARS_BUCKET = "custom-avatars";
      process.env.MINIO_DOCUMENTS_BUCKET = "custom-documents";

      const customService = new MinIOService();

      expect(customService.buckets.avatars).toBe("custom-avatars");
      expect(customService.buckets.documents).toBe("custom-documents");

      // Reset environment
      delete process.env.MINIO_AVATARS_BUCKET;
      delete process.env.MINIO_DOCUMENTS_BUCKET;
    });

    it("should create MinIO client with correct configuration", () => {
      const client = minioService.getClient();
      expect(client).toBeDefined();
    });
  });

  describe("init", () => {
    it("should initialize buckets successfully", async () => {
      mockMinioClient.bucketExists.mockResolvedValue(false);

      await minioService.init();

      expect(mockMinioClient.bucketExists).toHaveBeenCalledTimes(4);
      expect(mockMinioClient.makeBucket).toHaveBeenCalledTimes(4);
    });

    it("should handle existing buckets", async () => {
      mockMinioClient.bucketExists.mockResolvedValue(true);

      await minioService.init();

      expect(mockMinioClient.bucketExists).toHaveBeenCalledTimes(4);
      expect(mockMinioClient.makeBucket).not.toHaveBeenCalled();
    });

    it("should handle initialization errors", async () => {
      mockMinioClient.bucketExists.mockRejectedValue(
        new Error("Connection failed")
      );

      await expect(minioService.init()).rejects.toThrow("Connection failed");
    });
  });

  describe("generateFileName", () => {
    it("should generate unique file names", () => {
      const fileName = minioService.generateFileName("test.jpg", 1);

      expect(fileName).toMatch(/^1\/\d+-abcdef1234567890\.jpg$/);
    });

    it("should preserve file extensions", () => {
      const fileName = minioService.generateFileName("document.pdf", 1);

      expect(fileName).toMatch(/\.pdf$/);
    });

    it("should include prefix when provided", () => {
      const fileName = minioService.generateFileName("test.jpg", 1, "prefix/");

      expect(fileName).toMatch(/^prefix\/1\/\d+-abcdef1234567890\.jpg$/);
    });
  });

  describe("uploadFile", () => {
    it("should upload file successfully", async () => {
      const file = {
        originalname: "test.jpg",
        mimetype: "image/jpeg",
        size: 1024,
        buffer: Buffer.from("test content")
      };

      const result = await minioService.uploadFile("user-documents", file, 1);

      expect(result).toEqual({
        fileName: expect.stringMatching(/^1\/\d+-abcdef1234567890\.jpg$/),
        url: "https://presigned-url.com",
        size: 1024,
        mimetype: "image/jpeg",
        etag: "mock-etag"
      });

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        "user-documents",
        expect.any(String),
        Buffer.from("test content"),
        1024,
        expect.objectContaining({
          "Content-Type": "image/jpeg",
          "X-User-Id": "1"
        })
      );
    });

    it("should upload file with metadata", async () => {
      const file = {
        originalname: "test.jpg",
        mimetype: "image/jpeg",
        size: 1024,
        buffer: Buffer.from("test content")
      };

      const metadata = {
        "X-Custom-Header": "custom-value"
      };

      await minioService.uploadFile("user-documents", file, 1, metadata);

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        "user-documents",
        expect.any(String),
        Buffer.from("test content"),
        1024,
        expect.objectContaining({
          "Content-Type": "image/jpeg",
          "X-User-Id": "1",
          "X-Custom-Header": "custom-value"
        })
      );
    });

    it("should handle upload errors", async () => {
      const file = {
        originalname: "test.jpg",
        mimetype: "image/jpeg",
        size: 1024,
        buffer: Buffer.from("test content")
      };

      mockMinioClient.putObject.mockRejectedValue(new Error("Upload failed"));

      await expect(
        minioService.uploadFile("test-bucket", file, 1)
      ).rejects.toThrow("Upload failed");
    });
  });

  describe("getFileUrl", () => {
    it("should return direct URL for public buckets", async () => {
      const url = await minioService.getFileUrl("user-avatars", "test.jpg");

      expect(url).toBe("http://localhost:9000/user-avatars/test.jpg");
    });

    it("should return presigned URL for private buckets", async () => {
      const url = await minioService.getFileUrl("user-documents", "test.jpg");

      expect(url).toBe("https://presigned-url.com");
      expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
        "user-documents",
        "test.jpg",
        604800
      );
    });

    it("should handle URL generation errors", async () => {
      mockMinioClient.presignedGetObject.mockRejectedValue(
        new Error("URL generation failed")
      );

      await expect(
        minioService.getFileUrl("user-documents", "test.jpg")
      ).rejects.toThrow("URL generation failed");
    });
  });

  describe("deleteFile", () => {
    it("should delete file successfully", async () => {
      const result = await minioService.deleteFile(
        "user-documents",
        "test.jpg"
      );

      expect(result).toBe(true);
      expect(mockMinioClient.removeObject).toHaveBeenCalledWith(
        "user-documents",
        "test.jpg"
      );
    });

    it("should handle delete errors", async () => {
      mockMinioClient.removeObject.mockRejectedValue(
        new Error("Delete failed")
      );

      await expect(
        minioService.deleteFile("user-documents", "test.jpg")
      ).rejects.toThrow("Delete failed");
    });
  });

  describe("listUserFiles", () => {
    it("should list user files successfully", async () => {
      const result = await minioService.listUserFiles(1, "user-documents");

      expect(result).toEqual([
        {
          name: "1/1234567890-abcdef1234567890.jpg",
          size: 1024,
          lastModified: expect.any(Date),
          url: "https://presigned-url.com"
        }
      ]);
    });

    it("should handle list errors", async () => {
      mockMinioClient.listObjects.mockImplementation(() => {
        throw new Error("List failed");
      });

      await expect(
        minioService.listUserFiles(1, "user-documents")
      ).rejects.toThrow("List failed");
    });
  });

  describe("getFileStats", () => {
    it("should get file stats successfully", async () => {
      const stats = await minioService.getFileStats(
        "user-documents",
        "test.jpg"
      );

      expect(stats).toEqual({
        size: 1024,
        lastModified: expect.any(Date),
        etag: "mock-etag"
      });
    });

    it("should handle stats errors", async () => {
      mockMinioClient.statObject.mockRejectedValue(new Error("Stats failed"));

      await expect(
        minioService.getFileStats("user-documents", "test.jpg")
      ).rejects.toThrow("Stats failed");
    });
  });

  describe("healthCheck", () => {
    it("should return healthy status when all systems are working", async () => {
      const health = await minioService.healthCheck();

      expect(health).toEqual({
        status: "healthy",
        timestamp: expect.any(String)
      });
    });

    it("should return unhealthy status when MinIO is down", async () => {
      mockMinioClient.listBuckets.mockRejectedValue(
        new Error("Connection failed")
      );

      const health = await minioService.healthCheck();

      expect(health).toEqual({
        status: "unhealthy",
        error: "Connection failed",
        timestamp: expect.any(String)
      });
    });
  });
});
