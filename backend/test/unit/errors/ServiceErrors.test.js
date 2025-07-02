const {
  ServiceError,
  EmailServiceError,
  EmailTransporterError,
  EmailTemplateError,
  UserServiceError,
  UserNotFoundError,
  UserAuthenticationError,
  UserValidationError,
  Web3ServiceError,
  BlockchainConnectionError,
  TransactionError,
  QueueServiceError,
  QueueConnectionError,
  JobProcessingError,
  MinIOServiceError,
  FileUploadError,
  FileNotFoundError,
  DatabaseServiceError,
  DatabaseConnectionError,
  DatabaseQueryError
} = require("../../../src/errors/ServiceErrors");

describe("ServiceErrors", () => {
  describe("ServiceError", () => {
    test("should create base service error with default values", () => {
      const error = new ServiceError("Test error");

      expect(error.message).toBe("Test error");
      expect(error.name).toBe("ServiceError");
      expect(error.code).toBe("SERVICE_ERROR");
      expect(error.details).toEqual({});
      expect(error.timestamp).toBeDefined();
      expect(error.stack).toBeDefined();
    });

    test("should create service error with custom code and details", () => {
      const details = { userId: 123, action: "test" };
      const error = new ServiceError("Test error", "CUSTOM_CODE", details);

      expect(error.message).toBe("Test error");
      expect(error.code).toBe("CUSTOM_CODE");
      expect(error.details).toEqual(details);
    });
  });

  describe("EmailServiceError", () => {
    test("should create email service error", () => {
      const error = new EmailServiceError("Email failed");

      expect(error.message).toBe("Email failed");
      expect(error.name).toBe("EmailServiceError");
      expect(error.code).toBe("EMAIL_ERROR");
      expect(error.service).toBe("EmailService");
    });

    test("should create email transporter error", () => {
      const error = new EmailTransporterError("Transporter failed");

      expect(error.message).toBe("Transporter failed");
      expect(error.name).toBe("EmailTransporterError");
      expect(error.code).toBe("EMAIL_TRANSPORTER_ERROR");
      expect(error.service).toBe("EmailService");
    });

    test("should create email template error", () => {
      const error = new EmailTemplateError("Template failed");

      expect(error.message).toBe("Template failed");
      expect(error.name).toBe("EmailTemplateError");
      expect(error.code).toBe("EMAIL_TEMPLATE_ERROR");
      expect(error.service).toBe("EmailService");
    });
  });

  describe("UserServiceError", () => {
    test("should create user service error", () => {
      const error = new UserServiceError("User operation failed");

      expect(error.message).toBe("User operation failed");
      expect(error.name).toBe("UserServiceError");
      expect(error.code).toBe("USER_ERROR");
      expect(error.service).toBe("UserService");
    });

    test("should create user not found error", () => {
      const error = new UserNotFoundError(123);

      expect(error.message).toBe("User not found: 123");
      expect(error.name).toBe("UserNotFoundError");
      expect(error.code).toBe("USER_NOT_FOUND");
      expect(error.service).toBe("UserService");
    });

    test("should create user authentication error", () => {
      const error = new UserAuthenticationError("Invalid credentials");

      expect(error.message).toBe("Invalid credentials");
      expect(error.name).toBe("UserAuthenticationError");
      expect(error.code).toBe("USER_AUTHENTICATION_ERROR");
      expect(error.service).toBe("UserService");
    });

    test("should create user validation error", () => {
      const error = new UserValidationError("Invalid user data");

      expect(error.message).toBe("Invalid user data");
      expect(error.name).toBe("UserValidationError");
      expect(error.code).toBe("USER_VALIDATION_ERROR");
      expect(error.service).toBe("UserService");
    });
  });

  describe("Web3ServiceError", () => {
    test("should create web3 service error", () => {
      const error = new Web3ServiceError("Blockchain operation failed");

      expect(error.message).toBe("Blockchain operation failed");
      expect(error.name).toBe("Web3ServiceError");
      expect(error.code).toBe("WEB3_ERROR");
      expect(error.service).toBe("Web3Service");
    });

    test("should create blockchain connection error", () => {
      const error = new BlockchainConnectionError("Connection failed");

      expect(error.message).toBe("Connection failed");
      expect(error.name).toBe("BlockchainConnectionError");
      expect(error.code).toBe("BLOCKCHAIN_CONNECTION_ERROR");
      expect(error.service).toBe("Web3Service");
    });

    test("should create transaction error", () => {
      const error = new TransactionError("Transaction failed");

      expect(error.message).toBe("Transaction failed");
      expect(error.name).toBe("TransactionError");
      expect(error.code).toBe("TRANSACTION_ERROR");
      expect(error.service).toBe("Web3Service");
    });
  });

  describe("QueueServiceError", () => {
    test("should create queue service error", () => {
      const error = new QueueServiceError("Queue operation failed");

      expect(error.message).toBe("Queue operation failed");
      expect(error.name).toBe("QueueServiceError");
      expect(error.code).toBe("QUEUE_ERROR");
      expect(error.service).toBe("QueueService");
    });

    test("should create queue connection error", () => {
      const error = new QueueConnectionError("Redis connection failed");

      expect(error.message).toBe("Redis connection failed");
      expect(error.name).toBe("QueueConnectionError");
      expect(error.code).toBe("QUEUE_CONNECTION_ERROR");
      expect(error.service).toBe("QueueService");
    });

    test("should create job processing error", () => {
      const error = new JobProcessingError("Job processing failed");

      expect(error.message).toBe("Job processing failed");
      expect(error.name).toBe("JobProcessingError");
      expect(error.code).toBe("JOB_PROCESSING_ERROR");
      expect(error.service).toBe("QueueService");
    });
  });

  describe("MinIOServiceError", () => {
    test("should create minio service error", () => {
      const error = new MinIOServiceError("File operation failed");

      expect(error.message).toBe("File operation failed");
      expect(error.name).toBe("MinIOServiceError");
      expect(error.code).toBe("MINIO_ERROR");
      expect(error.service).toBe("MinIOService");
    });

    test("should create file upload error", () => {
      const error = new FileUploadError("Upload failed");

      expect(error.message).toBe("Upload failed");
      expect(error.name).toBe("FileUploadError");
      expect(error.code).toBe("FILE_UPLOAD_ERROR");
      expect(error.service).toBe("MinIOService");
    });

    test("should create file not found error", () => {
      const error = new FileNotFoundError("test.jpg");

      expect(error.message).toBe("File not found: test.jpg");
      expect(error.name).toBe("FileNotFoundError");
      expect(error.code).toBe("FILE_NOT_FOUND");
      expect(error.service).toBe("MinIOService");
    });
  });

  describe("DatabaseServiceError", () => {
    test("should create database service error", () => {
      const error = new DatabaseServiceError("Database operation failed");

      expect(error.message).toBe("Database operation failed");
      expect(error.name).toBe("DatabaseServiceError");
      expect(error.code).toBe("DATABASE_ERROR");
      expect(error.service).toBe("DatabaseService");
    });

    test("should create database connection error", () => {
      const error = new DatabaseConnectionError("Connection failed");

      expect(error.message).toBe("Connection failed");
      expect(error.name).toBe("DatabaseConnectionError");
      expect(error.code).toBe("DATABASE_CONNECTION_ERROR");
      expect(error.service).toBe("DatabaseService");
    });

    test("should create database query error", () => {
      const error = new DatabaseQueryError("Query failed");

      expect(error.message).toBe("Query failed");
      expect(error.name).toBe("DatabaseQueryError");
      expect(error.code).toBe("DATABASE_QUERY_ERROR");
      expect(error.service).toBe("DatabaseService");
    });
  });

  describe("Error inheritance", () => {
    test("all errors should be instances of Error", () => {
      const errors = [
        new ServiceError("test"),
        new EmailServiceError("test"),
        new UserServiceError("test"),
        new Web3ServiceError("test"),
        new QueueServiceError("test"),
        new MinIOServiceError("test"),
        new DatabaseServiceError("test")
      ];

      errors.forEach((error) => {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(ServiceError);
      });
    });

    test("specific errors should be instances of their parent classes", () => {
      expect(new EmailTransporterError("test")).toBeInstanceOf(
        EmailServiceError
      );
      expect(new UserNotFoundError(123)).toBeInstanceOf(UserServiceError);
      expect(new BlockchainConnectionError("test")).toBeInstanceOf(
        Web3ServiceError
      );
      expect(new QueueConnectionError("test")).toBeInstanceOf(
        QueueServiceError
      );
      expect(new FileUploadError("test")).toBeInstanceOf(MinIOServiceError);
      expect(new DatabaseConnectionError("test")).toBeInstanceOf(
        DatabaseServiceError
      );
    });
  });
});
