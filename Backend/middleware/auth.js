const jwt = require("jsonwebtoken");
const prisma = require("../config/database");
const AuthUtils = require("../utils/auth");

const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token required",
      });
    }

    const decoded = AuthUtils.verifyToken(token);
    if (!decoded)
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired access token" });
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        provider: true,
        isEmailVerified: true,
        isActive: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    if (decoded.sessionId) {
      const sessions = await prisma.refreshToken.findMany({
        where: {
          userId: user.id,
          isRevoked: false,
          expiresAt: { gt: new Date() },
        },
      });
      if (
        !sessions.some(
          (session) =>
            AuthUtils.verifyToken(session.token, process.env.JWT_REFRESH_SECRET)
              ?.sessionId === decoded.sessionId,
        )
      )
        return res
          .status(401)
          .json({ success: false, message: "Session was revoked" });
    }
    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    } else if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    } else {
      console.error("Authentication error:", error);
      return res.status(500).json({
        success: false,
        message: "Authentication failed",
      });
    }
  }
};

const requireVerified = (req, res, next) => {
  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: "Please verify your email address first",
    });
  }
  next();
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      });
    }

    next();
  };
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = AuthUtils.verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        provider: true,
        isEmailVerified: true,
        isActive: true,
      },
    });

    req.user = user || null;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

const extractToken = (req) => {
  let token = null;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.substring(7);
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  return token;
};

const setCorsHeaders = (req, res, next) => {
  res.header("Access-Control-Allow-Credentials", "true");
  next();
};

const checkOwnership = (resourceUserIdField = "userId") => {
  return (req, res, next) => {
    const resourceUserId =
      req.params[resourceUserIdField] || req.body[resourceUserIdField];

    if (!resourceUserId) {
      return res.status(400).json({
        success: false,
        message: "Resource owner ID required",
      });
    }

    if (req.user.role === "ADMIN") {
      return next();
    }

    if (req.user.id !== resourceUserId) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You can only access your own resources",
      });
    }

    next();
  };
};

class RequestWindowStore {
  constructor() {
    this.hits = new Map();
    this.localKeys = true;
  }
  init(options) {
    this.windowMs = options.windowMs;
  }
  async increment(key) {
    const now = Date.now();
    if (this.hits.size >= 10000) {
      for (const [storedKey, value] of this.hits)
        if (value.resetTime.getTime() <= now) this.hits.delete(storedKey);
      if (this.hits.size >= 10000 && !this.hits.has(key))
        throw new Error("Rate limit store capacity reached");
    }
    let value = this.hits.get(key);
    if (!value || value.resetTime.getTime() <= now) {
      value = { totalHits: 0, resetTime: new Date(now + this.windowMs) };
      this.hits.set(key, value);
    }
    value.totalHits += 1;
    return { ...value };
  }
  async decrement(key) {
    const value = this.hits.get(key);
    if (value) value.totalHits = Math.max(0, value.totalHits - 1);
  }
  async resetKey(key) {
    this.hits.delete(key);
  }
}

const authRateLimit = require("express-rate-limit")({
  store: new RequestWindowStore(),
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalRateLimit = require("express-rate-limit")({
  store: new RequestWindowStore(),
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Too many requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authenticate,
  requireVerified,
  authorize,
  optionalAuth,
  setCorsHeaders,
  checkOwnership,
  authRateLimit,
  generalRateLimit,
};
