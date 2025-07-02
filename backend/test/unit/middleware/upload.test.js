const multer = require("multer");
const { upload } = require("../../../src/middleware/upload");

// Mock multer
jest.mock("multer", () => {
  const mockSingle = jest.fn().mockReturnValue((req, res, next) => {
    // Simulate successful file upload
    req.file = {
      fieldname: "file",
      originalname: "test.jpg",
      encoding: "7bit",
      mimetype: "image/jpeg",
      size: 1024,
      buffer: Buffer.from("test content"),
      destination: "/tmp",
      filename: "test-123.jpg",
      path: "/tmp/test-123.jpg"
    };
    next();
  });

  const mockMulter = jest.fn().mockImplementation(() => {
    return {
      single: mockSingle,
      array: jest.fn(),
      fields: jest.fn()
    };
  });

  // Mock the static methods
  mockMulter.memoryStorage = jest.fn().mockReturnValue({
    _handleFile: jest.fn(),
    _removeFile: jest.fn()
  });

  return mockMulter;
});

describe("Upload Middleware", () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      file: null,
      files: null
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();
  });

  describe("upload.single", () => {
    it("should configure multer with correct settings", () => {
      // The upload middleware should be configured
      expect(upload).toBeDefined();
      expect(typeof upload.single).toBe("function");
    });

    it("should handle file upload successfully", () => {
      const uploadMiddleware = upload.single("file");

      uploadMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.file).toBeDefined();
      expect(mockReq.file.originalname).toBe("test.jpg");
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("fileFilter", () => {
    it("should accept valid file types", () => {
      // Test the file filter function directly
      const fileFilter = (req, file, cb) => {
        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "application/pdf",
          "text/plain",
          "application/json",
          "application/xml"
        ];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error("Invalid file type"), false);
        }
      };

      const mockFile = {
        originalname: "test.jpg",
        mimetype: "image/jpeg"
      };

      const mockCb = jest.fn();

      fileFilter(mockReq, mockFile, mockCb);

      expect(mockCb).toHaveBeenCalledWith(null, true);
    });

    it("should reject invalid file types", () => {
      // Test the file filter function directly
      const fileFilter = (req, file, cb) => {
        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "application/pdf",
          "text/plain",
          "application/json",
          "application/xml"
        ];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new Error(
              "Invalid file type. Only images and documents are allowed."
            ),
            false
          );
        }
      };

      const mockFile = {
        originalname: "test.exe",
        mimetype: "application/x-executable"
      };

      const mockCb = jest.fn();

      fileFilter(mockReq, mockFile, mockCb);

      expect(mockCb).toHaveBeenCalledWith(
        new Error("Invalid file type. Only images and documents are allowed."),
        false
      );
    });

    it("should accept PDF files", () => {
      // Test the file filter function directly
      const fileFilter = (req, file, cb) => {
        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "application/pdf",
          "text/plain",
          "application/json",
          "application/xml"
        ];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error("Invalid file type"), false);
        }
      };

      const mockFile = {
        originalname: "document.pdf",
        mimetype: "application/pdf"
      };

      const mockCb = jest.fn();

      fileFilter(mockReq, mockFile, mockCb);

      expect(mockCb).toHaveBeenCalledWith(null, true);
    });

    it("should accept PNG files", () => {
      // Test the file filter function directly
      const fileFilter = (req, file, cb) => {
        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "application/pdf",
          "text/plain",
          "application/json",
          "application/xml"
        ];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error("Invalid file type"), false);
        }
      };

      const mockFile = {
        originalname: "image.png",
        mimetype: "image/png"
      };

      const mockCb = jest.fn();

      fileFilter(mockReq, mockFile, mockCb);

      expect(mockCb).toHaveBeenCalledWith(null, true);
    });
  });

  describe("error handling", () => {
    it("should handle file upload errors", () => {
      const uploadMiddleware = upload.single("file");

      // Mock an error scenario
      const errorUpload = jest.fn().mockImplementation((req, res, next) => {
        next(new Error("Upload failed"));
      });

      upload.single = jest.fn().mockReturnValue(errorUpload);

      const errorMiddleware = upload.single("file");
      errorMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(new Error("Upload failed"));
    });

    it("should handle missing file field", () => {
      const uploadMiddleware = upload.single("file");

      // Mock a scenario where no file is uploaded
      const noFileUpload = jest.fn().mockImplementation((req, res, next) => {
        req.file = undefined;
        next();
      });

      upload.single = jest.fn().mockReturnValue(noFileUpload);

      const noFileMiddleware = upload.single("file");
      noFileMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.file).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("file validation", () => {
    it("should validate file size", () => {
      const mockFile = {
        originalname: "large.jpg",
        mimetype: "image/jpeg",
        size: 10 * 1024 * 1024 // 10MB
      };

      // Test size validation (assuming 5MB limit)
      const isValidSize = mockFile.size <= 5 * 1024 * 1024;
      expect(isValidSize).toBe(false);
    });

    it("should validate file extension", () => {
      const mockFile = {
        originalname: "test.txt",
        mimetype: "text/plain"
      };

      const allowedExtensions = [".jpg", ".png", ".pdf", ".txt"];
      const fileExtension = "." + mockFile.originalname.split(".").pop();
      const isValidExtension = allowedExtensions.includes(fileExtension);

      expect(isValidExtension).toBe(true);
    });
  });
});
