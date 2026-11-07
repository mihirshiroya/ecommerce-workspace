const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
);
app.use(
  cors({
    origin(origin, cb) {
      const trusted = [
        process.env.CLIENT_URL,
        process.env.V0_RUNTIME_URL,
        process.env.V0_DEV_APP_URL,
        process.env.V0_BUILD_URL,
        process.env.V0_SANDBOX_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
      ]
        .filter(Boolean)
        .map((v) => {
          try {
            return new URL(v).origin;
          } catch {
            return v;
          }
        });
      cb(null, !origin || trusted.includes(origin));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (
    req.method !== "GET" &&
    req.method !== "HEAD" &&
    req.method !== "OPTIONS" &&
    req.get("X-Requested-With") !== "ListingStudio"
  )
    return res
      .status(403)
      .json({ success: false, message: "Missing request verification header" });
  next();
});
app.get("/api/health", (_, res) =>
  res.json({
    success: true,
    data: {
      service: "Listing Studio",
      databaseConfigured: !!process.env.DATABASE_URL,
      authConfigured: !!(
        process.env.JWT_SECRET && process.env.JWT_REFRESH_SECRET
      ),
      emailConfigured: !!(
        process.env.EMAIL_HOST &&
        process.env.EMAIL_USER &&
        process.env.EMAIL_PASS &&
        process.env.EMAIL_FROM
      ),
    },
  }),
);
app.use(
  "/api/auth",
  (req, res, next) => {
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET)
      return res.status(503).json({
        success: false,
        message:
          "Authentication is awaiting secure JWT configuration. Your workspace data is not affected.",
      });
    next();
  },
  require("./routes/auth"),
);
app.use("/api/users", require("./routes/users"));
app.use("/api/workspace", require("./routes/workspace"));
app.use((req, res) =>
  res.status(404).json({ success: false, message: "Route not found" }),
);
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.name === "ZodError")
    return res.status(400).json({
      success: false,
      message: "Check the highlighted values",
      errors: error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
  if (error.code === "23505" || error.cause?.code === "23505")
    return res.status(409).json({
      success: false,
      message:
        "This SKU or account name already exists. Choose a unique value.",
    });
  if (error.code === "23503" || error.cause?.code === "23503")
    return res.status(409).json({
      success: false,
      message:
        "This record is referenced by workspace data. Deactivate it instead.",
    });
  const status = error.status || 500;
  if (status === 500) console.error("Application request failed", error);
  res.status(status).json({
    success: false,
    message:
      status === 500
        ? "Unable to complete this request. Please try again."
        : error.message,
    ...(error.details ? { errors: error.details } : {}),
  });
});
module.exports = app;
