/**
 * Base Service Class
 * Provides common functionality for all services
 */
class BaseService {
  constructor() {
    if (this.constructor === BaseService) {
      throw new Error("BaseService is abstract and cannot be instantiated");
    }
  }

  /**
   * Health check method that all services should implement
   * @returns {Promise<Object>} Health status object
   */
  async healthCheck() {
    throw new Error("healthCheck method must be implemented");
  }

  /**
   * Shutdown method for graceful service termination
   * @returns {Promise<void>}
   */
  async shutdown() {
    throw new Error("shutdown method must be implemented");
  }

  /**
   * Validate required environment variables
   * @param {Array<string>} requiredVars - Array of required environment variable names
   * @throws {Error} If any required environment variable is missing
   */
  validateEnvironment(requiredVars = []) {
    const missing = requiredVars.filter((varName) => !process.env[varName]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}`
      );
    }
  }

  /**
   * Log service events with consistent formatting
   * @param {string} level - Log level (info, warn, error, debug)
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const serviceName = this.constructor.name;
    const logEntry = {
      timestamp,
      service: serviceName,
      level,
      message,
      ...data
    };

    switch (level.toLowerCase()) {
      case "error":
        console.error(`❌ [${serviceName}] ${message}`, data);
        break;
      case "warn":
        console.warn(`⚠️ [${serviceName}] ${message}`, data);
        break;
      case "debug":
        console.debug(`🔍 [${serviceName}] ${message}`, data);
        break;
      default:
        console.log(`ℹ️ [${serviceName}] ${message}`, data);
    }
  }

  /**
   * Handle service errors with consistent error handling
   * @param {Error} error - The error to handle
   * @param {string} context - Context where the error occurred
   * @param {Object} additionalData - Additional data about the error
   * @returns {Object} Standardized error response
   */
  handleError(error, context = "", additionalData = {}) {
    const errorInfo = {
      message: error.message,
      context,
      service: this.constructor.name,
      timestamp: new Date().toISOString(),
      ...additionalData
    };

    this.log("error", `Error in ${context}: ${error.message}`, errorInfo);

    return {
      success: false,
      error: errorInfo
    };
  }

  /**
   * Create success response with consistent formatting
   * @param {any} data - Response data
   * @param {string} message - Success message
   * @returns {Object} Standardized success response
   */
  createSuccessResponse(data, message = "Operation completed successfully") {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = BaseService;
