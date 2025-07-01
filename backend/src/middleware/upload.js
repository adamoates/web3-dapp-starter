const multer = require("multer");
const jwt = require("jsonwebtoken");

// Middleware to authenticate JWT token
const authenticateToken = (pool) => {
  return async (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "your-secret-key"
      );

      // Verify user exists in database
      const userResult = await pool.query(
        "SELECT id, email, name FROM users WHERE id = $1",
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(403).json({ error: "User not found" });
      }

      req.user = userResult.rows[0];
      next();
    } catch (error) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
  };
};

// Configure multer for memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Define allowed file types per endpoint
  const allowedTypes = {
    image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    document: [
      "application/pdf",
      "text/plain",
      "application/json",
      "application/xml"
    ],
    avatar: ["image/jpeg", "image/png", "image/webp"],
    nft: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/webm"
    ],
    general: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "application/json"
    ]
  };

  // Determine upload type based on route
  let uploadType = "general";
  if (req.route.path.includes("avatar")) {
    uploadType = "avatar";
  } else if (req.route.path.includes("document")) {
    uploadType = "document";
  } else if (req.route.path.includes("nft")) {
    uploadType = "nft";
  } else if (req.route.path.includes("image")) {
    uploadType = "image";
  }

  if (allowedTypes[uploadType].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Allowed: ${allowedTypes[uploadType].join(", ")}`
      ),
      false
    );
  }
};

// Create multer instance with configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Max 5 files at once
  }
});

// Create authenticated upload middleware
const createUploadMiddleware = (pool) => {
  return [
    authenticateToken(pool),
    upload.single("file"), // or upload.array('files', 5) for multiple
    (error, req, res, next) => {
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "File too large (max 10MB)" });
        }
        if (error.code === "LIMIT_FILE_COUNT") {
          return res.status(400).json({ error: "Too many files (max 5)" });
        }
        if (error.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({ error: "Unexpected file field" });
        }
      }
      if (error) {
        return res.status(400).json({ error: error.message });
      }
      next();
    }
  ];
};

// Create multiple file upload middleware
const createMultipleUploadMiddleware = (pool, maxFiles = 5) => {
  return [
    authenticateToken(pool),
    upload.array("files", maxFiles),
    (error, req, res, next) => {
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "File too large (max 10MB)" });
        }
        if (error.code === "LIMIT_FILE_COUNT") {
          return res
            .status(400)
            .json({ error: `Too many files (max ${maxFiles})` });
        }
        if (error.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({ error: "Unexpected file field" });
        }
      }
      if (error) {
        return res.status(400).json({ error: error.message });
      }
      next();
    }
  ];
};

// Create field-specific upload middleware
const createFieldsUploadMiddleware = (pool, fields) => {
  return [
    authenticateToken(pool),
    upload.fields(fields),
    (error, req, res, next) => {
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "File too large (max 10MB)" });
        }
        if (error.code === "LIMIT_FILE_COUNT") {
          return res.status(400).json({ error: "Too many files" });
        }
        if (error.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({ error: "Unexpected file field" });
        }
      }
      if (error) {
        return res.status(400).json({ error: error.message });
      }
      next();
    }
  ];
};

// Utility function to validate file dimensions for images
const validateImageDimensions = (file, maxWidth = 1920, maxHeight = 1080) => {
  return new Promise((resolve, reject) => {
    if (!file.mimetype.startsWith("image/")) {
      resolve(true); // Not an image, skip validation
      return;
    }

    const img = new Image();
    img.onload = () => {
      if (img.width > maxWidth || img.height > maxHeight) {
        reject(
          new Error(`Image dimensions too large. Max: ${maxWidth}x${maxHeight}`)
        );
      } else {
        resolve(true);
      }
    };
    img.onerror = () => {
      reject(new Error("Invalid image file"));
    };
    img.src = URL.createObjectURL(file);
  });
};

// Utility function to sanitize filename
const sanitizeFilename = (filename) => {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/_{2,}/g, "_")
    .substring(0, 255);
};

module.exports = {
  createUploadMiddleware,
  createMultipleUploadMiddleware,
  createFieldsUploadMiddleware,
  upload,
  authenticateToken,
  validateImageDimensions,
  sanitizeFilename
};
