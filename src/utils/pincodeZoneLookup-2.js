import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load FE pincodes.json for zone mapping; fall back to local data if provided
const FE_PINCODES_PATH = path.join(__dirname, "../../../Tester-Frontend-main/public/pincodes.json");
const LOCAL_PINCODES_PATH = path.join(__dirname, "../../data/pincodes_zone.json");

let zoneMap = null;
function buildZoneMap(jsonArr) {
  const map = new Map();
  for (const item of jsonArr || []) {
    const pin = String(item.pincode || "");
    const zone = item.zone ? String(item.zone).toUpperCase() : null;
    if (pin && zone) map.set(pin, zone);
  }
  return map;
}

(() => {
  try {
    if (fs.existsSync(FE_PINCODES_PATH)) {
      const raw = JSON.parse(fs.readFileSync(FE_PINCODES_PATH, "utf-8"));
      zoneMap = buildZoneMap(raw);
      return;
    }
  } catch (e) {
    // continue to local fallback
  }
  try {
    if (fs.existsSync(LOCAL_PINCODES_PATH)) {
      const raw = JSON.parse(fs.readFileSync(LOCAL_PINCODES_PATH, "utf-8"));
      zoneMap = buildZoneMap(raw);
      return;
    }
  } catch (e) {
    // no-op; keep zoneMap as null
  }
})();

export function zoneForPincode(pin) {
  if (!pin) return null;
  const p = String(pin);
  if (zoneMap && zoneMap.has(p)) return zoneMap.get(p);
  return null;
}
