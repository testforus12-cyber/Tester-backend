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

// ⬇️ NEW: FTL (Wheelseye) vendor routes
import vendorRoute from "./routes/vendorRoute.js";

// ⬇️ NEW: Freight Rate routes
import freightRateRoute from "./routes/freightRateRoute.js";

// ⬇️ NEW: Wheelseye Pricing routes
import wheelseyePricingRoute from "./routes/wheelseyePricingRoute.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// ─── MIDDLEWARE ─────────────────────────────────────────────────────────────
app.use(morgan("dev"));

// ✅ Keep CORS tight for local + (optionally) your deployed frontend via env
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  process.env.CLIENT_ORIGIN, // e.g. https://your-frontend.netlify.app
].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // allow same-origin / curl / server-to-server (no Origin header)
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── DATABASE ────────────────────────────────────────────────────────────────
console.log('🔌 Connecting to database...');
connectDatabase().then(() => {
  console.log('✅ Database connected successfully');
}).catch(err => {
  console.error('❌ Database connection failed:', err);
  process.exit(1);
});

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoute);
app.use("/api/transporter", transporterRoute);
app.use("/api/admin", adminRoute);
app.use("/api/bidding", biddingRoute);

// ⬇️ NEW: mount vendor endpoints (FTL / Wheelseye)
app.use("/api/vendor", vendorRoute);

// ⬇️ NEW: mount freight rate endpoints
app.use("/api/freight-rate", freightRateRoute);

// ⬇️ NEW: mount Wheelseye pricing endpoints
app.use("/api/wheelseye", wheelseyePricingRoute);

// (kept) bulk upload stub
app.post("/upload", async (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ success: false, error: "No records provided" });
  }
  try {
    console.log("Received records:", records);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── START SERVER ────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`🚀 Server started at http://localhost:${PORT}`);
  console.log('📋 Available routes:');
  console.log('  - POST /api/vendor/wheelseye-pricing');
  console.log('  - POST /api/vendor/wheelseye-distance');
  console.log('  - GET /api/wheelseye/pricing');
});

// Keep the server running
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
