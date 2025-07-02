/**
 * Base Service Error Class
 */
class ServiceError extends Error {
  constructor(message, code = "SERVICE_ERROR", details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Email Service Specific Errors
 */
class EmailServiceError extends ServiceError {
  constructor(message, code = "EMAIL_ERROR", details = {}) {
    super(message, code, details);
    this.service = "EmailService";
  }
}

class EmailTransporterError extends EmailServiceError {
  constructor(message, details = {}) {
    super(message, "EMAIL_TRANSPORTER_ERROR", details);
  }
}

class EmailTemplateError extends EmailServiceError {
  constructor(message, details = {}) {
    super(message, "EMAIL_TEMPLATE_ERROR", details);
  }
}

/**
 * User Service Specific Errors
 */
class UserServiceError extends ServiceError {
  constructor(message, code = "USER_ERROR", details = {}) {
    super(message, code, details);
    this.service = "UserService";
  }
}

class UserNotFoundError extends UserServiceError {
  constructor(userId, details = {}) {
    super(`User not found: ${userId}`, "USER_NOT_FOUND", details);
  }
}

class UserAuthenticationError extends UserServiceError {
  constructor(message, details = {}) {
    super(message, "USER_AUTHENTICATION_ERROR", details);
  }
}

class UserValidationError extends UserServiceError {
  constructor(message, details = {}) {
    super(message, "USER_VALIDATION_ERROR", details);
  }
}

/**
 * Web3 Service Specific Errors
 */
class Web3ServiceError extends ServiceError {
  constructor(message, code = "WEB3_ERROR", details = {}) {
    super(message, code, details);
    this.service = "Web3Service";
  }
}

class BlockchainConnectionError extends Web3ServiceError {
  constructor(message, details = {}) {
    super(message, "BLOCKCHAIN_CONNECTION_ERROR", details);
  }
}

class TransactionError extends Web3ServiceError {
  constructor(message, details = {}) {
    super(message, "TRANSACTION_ERROR", details);
  }
}

/**
 * Queue Service Specific Errors
 */
class QueueServiceError extends ServiceError {
  constructor(message, code = "QUEUE_ERROR", details = {}) {
    super(message, code, details);
    this.service = "QueueService";
  }
}

class QueueConnectionError extends QueueServiceError {
  constructor(message, details = {}) {
    super(message, "QUEUE_CONNECTION_ERROR", details);
  }
}

class JobProcessingError extends QueueServiceError {
  constructor(message, details = {}) {
    super(message, "JOB_PROCESSING_ERROR", details);
  }
}

/**
 * MinIO Service Specific Errors
 */
class MinIOServiceError extends ServiceError {
  constructor(message, code = "MINIO_ERROR", details = {}) {
    super(message, code, details);
    this.service = "MinIOService";
  }
}

class FileUploadError extends MinIOServiceError {
  constructor(message, details = {}) {
    super(message, "FILE_UPLOAD_ERROR", details);
  }
}

class FileNotFoundError extends MinIOServiceError {
  constructor(fileName, details = {}) {
    super(`File not found: ${fileName}`, "FILE_NOT_FOUND", details);
  }
}

/**
 * Database Service Specific Errors
 */
class DatabaseServiceError extends ServiceError {
  constructor(message, code = "DATABASE_ERROR", details = {}) {
    super(message, code, details);
    this.service = "DatabaseService";
  }
}

class DatabaseConnectionError extends DatabaseServiceError {
  constructor(message, details = {}) {
    super(message, "DATABASE_CONNECTION_ERROR", details);
  }
}

class DatabaseQueryError extends DatabaseServiceError {
  constructor(message, details = {}) {
    super(message, "DATABASE_QUERY_ERROR", details);
  }
}

module.exports = {
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
};
