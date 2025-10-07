// index.js
import express from "express";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";

import connectDatabase from "./db/db.js";
import adminRoute from "./routes/adminRoute.js";
import authRoute from "./routes/authRoute.js";
import transporterRoute from "./routes/transporterRoute.js";
import biddingRoute from "./routes/biddingRoute.js";

// FTL (Wheelseye) vendor routes
import vendorRoute from "./routes/vendorRoute.js";
// Freight Rate routes
import freightRateRoute from "./routes/freightRateRoute.js";
// Wheelseye Pricing routes
import wheelseyePricingRoute from "./routes/wheelseyePricingRoute.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// ─── MIDDLEWARE ─────────────────────────────────────────────────────────────
app.use(morgan("dev"));

// ✅ CORS allowlist (no trailing slashes)
const STATIC_ALLOWED = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://tester-frontend-34h73mybs-testforus12-cybers-projects.vercel.app",
  "http://127.0.0.1:3000",
"http://localhost:5173",
"http://127.0.0.1:5173",
"https://newtesterfrontend.netlify.app",
"https://tester-frontend-bxo2-3h45p0xjm-testforus12-cybers-projects.vercel.app",
'https://peaceful-halva-d8c713.netlify.app',
"https://transporter-signup.netlify.app",
'https://freightcompare.netlify.app',
];

// Optional: add more origins via env as a comma-separated list
const EXTRA_ALLOWED = (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = new Set([...STATIC_ALLOWED, ...EXTRA_ALLOWED]);

app.use(
  cors({
    origin: (origin, cb) => {
      // allow same-origin / curl / server-to-server (no Origin header)
      if (!origin) return cb(null, true);

      // exact allowlist match
      if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);

      // optional: allow any vercel.app subdomain (comment out if you want it stricter)
      try {
        const host = new URL(origin).hostname;
        if (host.endsWith(".vercel.app")) return cb(null, true);
      } catch { /* ignore bad origins */ }

      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    optionsSuccessStatus: 200, // helps some proxies/browsers with preflight
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Simple health checks
app.get("/", (_req, res) => res.send("API is running"));
app.get("/health", (_req, res) => res.json({ ok: true }));

// ─── DATABASE ────────────────────────────────────────────────────────────────
console.log("🔌 Connecting to database...");
connectDatabase()
  .then(() => console.log("✅ Database connected successfully"))
  .catch((err) => {
    console.error("❌ Database connection failed:", err);
    process.exit(1);
  });

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoute);
app.use("/api/transporter", transporterRoute);
app.use("/api/admin", adminRoute);
app.use("/api/bidding", biddingRoute);
app.use("/api/vendor", vendorRoute);
app.use("/api/freight-rate", freightRateRoute);
app.use("/api/wheelseye", wheelseyePricingRoute);

// Bulk upload stub
app.post("/upload", async (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ success: false, error: "No records provided" });
  }
  try {
    console.log("Received records:", records.length);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── START SERVER ────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
  console.log("📋 Available routes:");
  console.log("  - POST /api/vendor/wheelseye-pricing");
  console.log("  - POST /api/vendor/wheelseye-distance");
  console.log("  - GET  /api/wheelseye/pricing");
});

process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down server...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});
