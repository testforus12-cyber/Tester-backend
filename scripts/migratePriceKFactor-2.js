// scripts/migratePriceKFactor.js
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";

let Price;
try {
  Price = (await import("../model/pricemodel.js")).default;
} catch (e1) {
  try {
    Price = (await import("../models/pricemodel.js")).default;
  } catch (e2) {
    console.error("❌ Could not locate pricemodel.js in model/ or models/:", e2);
    process.exit(1);
  }
}

async function migrate() {
  // accept either URI variable name
  const mongoUri = process.env.MONGO_URI || process.env.MONGO_DB_URL || process.env.MONGO_DB_URL;
  if (!mongoUri) {
    console.error("❌ Neither MONGO_URI nor MONGO_DB_URL is set in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    const missing = await Price.find({ "priceRate.kFactor": { $exists: false } });
    if (missing.length === 0) {
      console.log("✅ All price documents already have kFactor. Nothing to do.");
    } else {
      for (const doc of missing) {
        const divisor = doc.priceRate?.divisor ?? 1;
        doc.priceRate.kFactor = divisor;
        await doc.save();
        console.log(`Patched price doc ${doc._id}: kFactor=${divisor}`);
      }
      console.log(`✅ Migrated ${missing.length} price documents.`);
    }
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0);
  }
}

migrate();
