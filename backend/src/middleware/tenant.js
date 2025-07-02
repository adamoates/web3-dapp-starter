const TenantService = require("../services/TenantService");

let tenantService;

// Initialize the middleware with database connections
function initializeTenant(databases) {
  tenantService = new TenantService(databases);
}

/**
 * Resolve tenant from request and attach to req.tenant
 */
async function resolveTenant(req, res, next) {
  try {
    if (!tenantService) {
      throw new Error("TenantService not initialized");
    }

    const tenant = await tenantService.resolveTenantFromRequest(req);
    req.tenant = tenant;
    next();
  } catch (error) {
    console.error("Tenant resolution error:", error);
    return res.status(400).json({
      error: "Invalid tenant",
      message: error.message
    });
  }
}

/**
 * Require tenant to be resolved
 */
function requireTenant(req, res, next) {
  if (!req.tenant) {
    return res.status(400).json({
      error: "Tenant required",
      message: "No tenant found in request"
    });
  }
  next();
}

/**
 * Validate that user belongs to the resolved tenant
 */
async function validateTenantAccess(req, res, next) {
  try {
    if (!req.tenant || !req.user) {
      return res.status(400).json({
        error: "Tenant and user required",
        message: "Both tenant and user must be resolved"
      });
    }

    const hasAccess = await tenantService.validateTenantAccess(
      req.tenant.id,
      req.user.userId
    );

    if (!hasAccess) {
      return res.status(403).json({
        error: "Tenant access denied",
        message: "User does not have access to this tenant"
      });
    }

    next();
  } catch (error) {
    console.error("Tenant access validation error:", error);
    return res.status(500).json({
      error: "Tenant validation failed",
      message: error.message
    });
  }
}

/**
 * Check if a feature is enabled for the current tenant
 */
function requireFeature(feature) {
  return async (req, res, next) => {
    try {
      if (!req.tenant) {
        return res.status(400).json({
          error: "Tenant required",
          message: "No tenant found in request"
        });
      }

      const isEnabled = await tenantService.isFeatureEnabled(
        req.tenant.id,
        feature
      );

      if (!isEnabled) {
        return res.status(403).json({
          error: "Feature disabled",
          message: `Feature '${feature}' is not enabled for this tenant`
        });
      }

      next();
    } catch (error) {
      console.error(`Feature check error for ${feature}:`, error);
      return res.status(500).json({
        error: "Feature validation failed",
        message: error.message
      });
    }
  };
}

/**
 * Optional tenant resolution - doesn't fail if no tenant found
 */
async function optionalTenant(req, res, next) {
  try {
    if (!tenantService) {
      return next();
    }

    const tenant = await tenantService.resolveTenantFromRequest(req);
    req.tenant = tenant;
    next();
  } catch (error) {
    // Don't fail, just continue without tenant
    console.warn("Optional tenant resolution failed:", error.message);
    next();
  }
}

/**
 * Extract tenant from JWT token
 */
function extractTenantFromToken(req, res, next) {
  try {
    if (req.user && req.user.tenantId) {
      // Tenant ID is already in the JWT token
      req.tenantId = req.user.tenantId;
    }
    next();
  } catch (error) {
    console.error("Tenant extraction from token error:", error);
    next();
  }
}

/**
 * Add tenant context to request
 */
function tenantContext(req, res, next) {
  const tenantId = req.tenantId || req.tenant?.id;
  const userId = req.user?.id || req.user?.userId;
  const userTenantId = req.user?.tenantId;

  req.tenantContext = {
    tenantId,
    userId,
    userTenantId,
    isCrossTenant: userTenantId && userTenantId !== tenantId
  };

  next();
}

/**
 * Add tenant isolation to query parameters
 */
function tenantIsolation(req, res, next) {
  const tenantId = req.tenantId || req.tenant?.id;

  if (tenantId) {
    req.query = req.query || {};
    req.query.tenantId = tenantId;
  }

  next();
}

/**
 * Add audit information to request
 */
function tenantAudit(req, res, next) {
  const tenantId = req.tenantId || req.tenant?.id;
  const userId = req.user?.id || req.user?.userId;
  const userEmail = req.user?.email;

  req.auditInfo = {
    tenantId,
    userId,
    userEmail,
    action: `${req.method} ${req.path}`,
    timestamp: new Date(),
    ip: req.ip
  };

  next();
}

module.exports = {
  initializeTenant,
  resolveTenant,
  requireTenant,
  validateTenantAccess,
  requireFeature,
  optionalTenant,
  extractTenantFromToken,
  tenantContext,
  tenantIsolation,
  tenantAudit
};
