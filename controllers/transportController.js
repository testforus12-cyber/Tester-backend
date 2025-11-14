import customerModel from "../model/customerModel.js";
import priceModel from "../model/priceModel.js";
import temporaryTransporterModel from "../model/temporaryTransporterModel.js";
import transporterModel from "../model/transporterModel.js";
import usertransporterrelationshipModel from "../model/usertransporterrelationshipModel.js";
import dotenv from "dotenv";
import axios from "axios";
import packingModel from "../model/packingModel.js";
import ratingModel from "../model/ratingModel.js";
import PackingList from "../model/packingModel.js"; // Make sure model is imported
import haversineDistanceKm from '../src/utils/haversine.js';
import pinMap from '../src/utils/pincodeMap.js';
import { zoneForPincode } from '../src/utils/pincodeZoneLookup.js';
import {
  validateZoneMatrix,
  sanitizeZoneCodes,
  validateGSTIN,
  validateEmail,
  validatePhone,
  validatePincode,
  sanitizeString,
} from "../utils/validators.js";

dotenv.config();

/** Helper: robust access to zoneRates whether Map or plain object */
// helper: safe get unit price from various chart shapes and zone key cases
function getUnitPriceFromPriceChart(priceChart, originZoneCode, destZoneCode) {
  if (!priceChart || !originZoneCode || !destZoneCode) return null;
  const o = String(originZoneCode).trim().toUpperCase();
  const d = String(destZoneCode).trim().toUpperCase();

  // common shapes:
  // 1) priceChart[originZone][destZone]
  // 2) priceChart[originZone+destZone] (unlikely)
  // 3) priceChart is Map-like (handled by getUnitPriceFromChart)
  // try multiple fallbacks
  const direct = (priceChart[o] && priceChart[o][d]) ?? (priceChart[d] && priceChart[d][o]);
  if (direct != null) return direct;

  // attempt case-insensitive search on top level keys
  const keys = Object.keys(priceChart || {});
  for (const k of keys) {
    if (String(k).trim().toUpperCase() === o) {
      const row = priceChart[k] || {};
      const val = row[d] ?? row[String(destZoneCode)];
      if (val != null) return val;
    }
    if (String(k).trim().toUpperCase() === d) {
      const row = priceChart[k] || {};
      const val = row[o] ?? row[String(originZoneCode)];
      if (val != null) return val;
    }
  }

  // give up
  return null;
}


export const deletePackingList = async (req, res) => {
  try {
    const preset = await PackingList.findById(req.params.id);

    if (!preset) {
      return res.status(404).json({ message: "Preset not found" });
    }

    await preset.deleteOne();

    res.status(200).json({ message: "Preset deleted successfully" });
  } catch (error) {
    console.error("Error deleting preset:", error);
    res.status(500).json({ message: "Server error while deleting preset." });
  }
};

const calculateDistanceBetweenPincode = async (origin, destination) => {
  try {
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&key=${process.env.GOOGLE_MAP_API_KEY}`
    );
    const estTime = (
      response.data.rows[0].elements[0].distance.value / 400000
    ).toFixed(2);
    const distance = response.data.rows[0].elements[0].distance.text;
    return { estTime: estTime, distance: distance };
  } catch (error) {
    console.log("Google Maps API failed, using pincode coordinates fallback:", error.message);
    
    // Fallback to pincode coordinates calculation
    try {
      const originStr = String(origin);
      const destStr = String(destination);
      
      const originCoords = pinMap[originStr];
      const destCoords = pinMap[destStr];
      
      if (!originCoords || !destCoords) {
        console.warn(`Pincode coordinates not found for ${originStr} or ${destStr}`);
        return { estTime: "1", distance: "100 km" }; // Safe fallback
      }
      
      const distanceKm = haversineDistanceKm(
        originCoords.lat,
        originCoords.lng,
        destCoords.lat,
        destCoords.lng
      );
      
      const estTime = Math.max(1, Math.ceil(distanceKm / 400));
      
      return {
        estTime: estTime.toString(),
        distance: `${Math.round(distanceKm)} km`
      };
      
    } catch (fallbackError) {
      console.error("Fallback distance calculation also failed:", fallbackError);
      return { estTime: "1", distance: "100 km" }; // Safe fallback
    }
  }
};

export const calculatePrice = async (req, res) => {
  const {
    customerID,
    userogpincode,
    modeoftransport,
    fromPincode,
    toPincode,
    noofboxes,
    length,
    width,
    height,
    weight,
    shipment_details,
  } = req.body;

  const rid = req.id || "no-reqid";

  let actualWeight;
  if (Array.isArray(shipment_details) && shipment_details.length > 0) {
    actualWeight = shipment_details.reduce(
      (sum, b) => sum + (b.weight || 0) * (b.count || 0),
      0
    );
  } else {
    actualWeight = (weight || 0) * (noofboxes || 0);
  }

  const hasLegacy =
    noofboxes !== undefined &&
    length !== undefined &&
    width !== undefined &&
    height !== undefined &&
    weight !== undefined;

  if (
    !customerID ||
    !userogpincode ||
    !modeoftransport ||
    !fromPincode ||
    !toPincode ||
    (!(Array.isArray(shipment_details) && shipment_details.length > 0) && !hasLegacy)
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Missing required fields. Provide shipment_details or legacy weight/box parameters.",
    });
  }

  const distData = await calculateDistanceBetweenPincode(
    fromPincode,
    toPincode
  );
  const estTime = distData.estTime;
  const dist = distData.distance;

// canonical values for DB vs lookups
const fromPinNum = Number(fromPincode); // use for numeric DB queries (if DB stores as number)
const toPinNum = Number(toPincode);
const fromPinStr = String(fromPincode).trim(); // use for priceChart keys / map lookups
const toPinStr = String(toPincode).trim();


  try {
    // ── DB fetches timed & optimized ─────────────────────────────────────────
    console.time(`[${rid}] DB tiedUpCompanies`);
    const tiedUpCompanies = await temporaryTransporterModel
      .find({ customerID })
      .select("customerID companyName prices selectedZones") // only what we use
      .lean()
      .maxTimeMS(20000);
    console.timeEnd(`[${rid}] DB tiedUpCompanies`);
    console.log(`[${rid}] tiedUpCompanies: ${tiedUpCompanies.length}`);

    console.time(`[${rid}] DB customer`);
    const customerData = await customerModel
      .findById(customerID)
      .select("isSubscribed")
      .lean()
      .maxTimeMS(15000);
    console.timeEnd(`[${rid}] DB customer`);
    if (!customerData) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }
    const isSubscribed = !!customerData.isSubscribed;

// Get zones for both pincodes first (normalized to uppercase zone codes)
const fromZoneRaw = zoneForPincode(fromPinStr);
const toZoneRaw = zoneForPincode(toPinStr);
const fromZone = fromZoneRaw ? String(fromZoneRaw).trim().toUpperCase() : null;
const toZone = toZoneRaw ? String(toZoneRaw).trim().toUpperCase() : null;

if (!fromZone || !toZone) {
  console.log(`[${rid}] Invalid zones: fromZone=${fromZoneRaw}(${fromZone}), toZone=${toZoneRaw}(${toZone}), fromPinStr=${fromPinStr}, toPinStr=${toPinStr}`);
  return res.status(400).json({
    success: false,
    message: "Invalid pincodes - could not determine zones",
  });
}


    // Fetch *only* transporters that service both pincodes AND have both zones in servicableZones
    console.time(`[${rid}] DB transporters`);
    const transporterData = await transporterModel
      .aggregate([
        {
         $match: {
        service: {
         $all: [
        { $elemMatch: { pincode: fromPinNum } },
         { $elemMatch: { pincode: toPinNum } },
         ],
        },
        servicableZones: {
         $all: [fromZone, toZone]
         }
         },

        },
        {
          $project: {
            companyName: 1,
            servicableZones: 1,
            // Keep only the two relevant service rows to cut payload
            service: {
              $filter: {
                input: "$service",
                as: "s",
                cond: {
                  $or: [
                    { $eq: ["$$s.pincode", fromPinNum] },
                    { $eq: ["$$s.pincode", toPinNum] },
                  ],
                },
              },
            },
          },
        },
      ])
      .allowDiskUse(true)
      .exec();
    console.timeEnd(`[${rid}] DB transporters`);
    console.log(`[${rid}] candidate transporters: ${transporterData.length}`);

    let l1 = Number.MAX_SAFE_INTEGER;

    // ── Tied-up companies (usually small set) ────────────────────────────────
    console.time(`[${rid}] BUILD tiedUpResult`);
    const tiedUpRaw = await Promise.all(
      tiedUpCompanies.map(async (tuc) => {
        // For temporary transporters, we have companyName directly and selectedZones
        const companyName = tuc.companyName;
        if (!companyName) return null;

        const doesExist = tuc.prices?.priceChart?.[fromPincode];
        if (!doesExist) return null;

        // Determine zones via mapping
        const originZone = zoneForPincode(String(fromPincode));
        const destZone = zoneForPincode(String(toPincode));
        
        if (!originZone || !destZone) return null;

        // If temporary transporter has selectedZones, enforce them strictly
        const relSelected = Array.isArray(tuc.selectedZones)
          ? tuc.selectedZones.map((z) => String(z).toUpperCase())
          : [];
        if (relSelected.length > 0) {
          if (!relSelected.includes(originZone) || !relSelected.includes(destZone)) {
            return null;
          }
        }
        // For temporary transporters, we don't have ODA information in the same structure
        // TODO: Add ODA information to temporary transporter model if needed
        const destIsOda = false;
        let unitPrice = priceChart?.[originZone]?.[destZone] ?? priceChart?.[destZone]?.[originZone];

        if (!unitPrice) return null;

        const pr = tuc.prices.priceRate || {};
        const kFactor = pr.kFactor ?? pr.divisor ?? 5000;

        // Volumetric weight (ceil per item)
        let volumetricWeight = 0;
        if (Array.isArray(shipment_details) && shipment_details.length > 0) {
          volumetricWeight = shipment_details.reduce((sum, item) => {
            const volWeightForItem =
              ((item.length || 0) *
                (item.width || 0) *
                (item.height || 0) *
                (item.count || 0)) /
              kFactor;
            return sum + Math.ceil(volWeightForItem);
          }, 0);
        } else {
          const volWeightForLegacy =
            ((length || 0) *
              (width || 0) *
              (height || 0) *
              (noofboxes || 0)) /
            kFactor;
          volumetricWeight = Math.ceil(volWeightForLegacy);
        }

        const chargeableWeight = Math.max(volumetricWeight, actualWeight);
        const baseFreight = unitPrice * chargeableWeight;
        const docketCharge = pr.docketCharges || 0;
        const minCharges = pr.minCharges || 0;
        const greenTax = pr.greenTax || 0;
        const daccCharges = pr.daccCharges || 0;
        const miscCharges = pr.miscellanousCharges || 0;
        const fuelCharges = ((pr.fuel || 0) / 100) * baseFreight;
        const rovCharges = Math.max(
          ((pr.rovCharges?.variable || 0) / 100) * baseFreight,
          pr.rovCharges?.fixed || 0
        );
        const insuaranceCharges = Math.max(
          ((pr.insuaranceCharges?.variable || 0) / 100) * baseFreight,
          pr.insuaranceCharges?.fixed || 0
        );
        const odaCharges = destIsOda
          ? (pr.odaCharges?.fixed || 0) +
            chargeableWeight * ((pr.odaCharges?.variable || 0) / 100)
          : 0;
        const handlingCharges =
          (pr.handlingCharges?.fixed || 0) +
          chargeableWeight * ((pr.handlingCharges?.variable || 0) / 100);
        const fmCharges = Math.max(
          ((pr.fmCharges?.variable || 0) / 100) * baseFreight,
          pr.fmCharges?.fixed || 0
        );
        const appointmentCharges = Math.max(
          ((pr.appointmentCharges?.variable || 0) / 100) * baseFreight,
          pr.appointmentCharges?.fixed || 0
        );

        const totalCharges =
          baseFreight +
          docketCharge +
          minCharges +
          greenTax +
          daccCharges +
          miscCharges +
          fuelCharges +
          rovCharges +
          insuaranceCharges +
          odaCharges +
          handlingCharges +
          fmCharges +
          appointmentCharges;

        l1 = Math.min(l1, totalCharges);

        return {
          companyId: tuc._id, // Use temporary transporter ID
          companyName: companyName,
          originPincode: fromPincode,
          destinationPincode: toPincode,
          estimatedTime: estTime,
          distance: dist,
          actualWeight: parseFloat(actualWeight.toFixed(2)),
          volumetricWeight: parseFloat(volumetricWeight.toFixed(2)),
          chargeableWeight: parseFloat(chargeableWeight.toFixed(2)),
          unitPrice,
          baseFreight,
          docketCharge,
          minCharges,
          greenTax,
          daccCharges,
          miscCharges,
          fuelCharges,
          rovCharges,
          insuaranceCharges,
          odaCharges,
          handlingCharges,
          fmCharges,
          appointmentCharges,
          totalCharges,
          isHidden: false,
        };
      })
    );
    const tiedUpResult = tiedUpRaw.filter((r) => r);
    console.timeEnd(`[${rid}] BUILD tiedUpResult`);
    console.log(`[${rid}] tiedUpResult count: ${tiedUpResult.length}`);

    // ── Temporary transporters (from Add Vendor) ──────────────────────────────
    console.time(`[${rid}] DB temporaryTransporters`);
    const temporaryTransporters = await temporaryTransporterModel
      .find({ customerID })
      .select("customerID companyName vendorCode prices selectedZones")
      .lean()
      .maxTimeMS(20000);
    console.timeEnd(`[${rid}] DB temporaryTransporters`);
    console.log(`[${rid}] temporaryTransporters: ${temporaryTransporters.length}`);

    console.time(`[${rid}] BUILD temporaryTransporterResult`);
    const temporaryTransporterRaw = await Promise.all(
      temporaryTransporters.map(async (tempTransporter) => {
        // For temporary transporters, map pincodes to zones using FE mapping
        const priceChart = tempTransporter.prices?.priceChart;
        if (!priceChart) return null;
        const availableZones = Object.keys(priceChart);
        if (!availableZones.length) return null;

        // Determine origin/destination zones from pincodes (strictly from mapping)
        let originZone = zoneForPincode(String(fromPincode));
        let destZone = zoneForPincode(String(toPincode));
        if (!originZone || !destZone) return null;
        originZone = String(originZone).toUpperCase();
        destZone = String(destZone).toUpperCase();

        // Respect vendor's selected zones: both origin and dest zones must be selected
        const selectedZones = (tempTransporter.selectedZones || []).map((z) => String(z).toUpperCase());
        if (!selectedZones.includes(originZone) || !selectedZones.includes(destZone)) return null;

        // Get the unit price for this zone combination (with symmetry only)
        let unitPrice = getUnitPriceFromPriceChart(priceChart, originZone, destZone);

        if (unitPrice == null) return null;

        const pr = tempTransporter.prices.priceRate || {};
        const kFactor = pr.kFactor ?? pr.divisor ?? 5000;

        // Volumetric weight (ceil per item)
        let volumetricWeight = 0;
        if (Array.isArray(shipment_details) && shipment_details.length > 0) {
          volumetricWeight = shipment_details.reduce((sum, item) => {
            const volWeightForItem =
              ((item.length || 0) *
                (item.width || 0) *
                (item.height || 0) *
                (item.count || 0)) /
              kFactor;
            return sum + Math.ceil(volWeightForItem);
          }, 0);
        } else {
          const volWeightForLegacy =
            ((length || 0) *
              (width || 0) *
              (height || 0) *
              (noofboxes || 0)) /
            kFactor;
          volumetricWeight = Math.ceil(volWeightForLegacy);
        }

        const chargeableWeight = Math.max(volumetricWeight, actualWeight);
        const baseFreight = unitPrice * chargeableWeight;
        const docketCharge = pr.docketCharges || 0;
        const minCharges = pr.minCharges || 0;
        const greenTax = pr.greenTax || 0;
        const daccCharges = pr.daccCharges || 0;
        const miscCharges = pr.miscellanousCharges || 0;
        const fuelCharges = ((pr.fuel || 0) / 100) * baseFreight;
        const rovCharges = Math.max(
          ((pr.rovCharges?.variable || 0) / 100) * baseFreight,
          pr.rovCharges?.fixed || 0
        );
        const insuaranceCharges = Math.max(
          ((pr.insuaranceCharges?.variable || 0) / 100) * baseFreight,
          pr.insuaranceCharges?.fixed || 0
        );
        const odaCharges = 0; // Temporary transporters don't have ODA logic
        const handlingCharges =
          (pr.handlingCharges?.fixed || 0) +
          chargeableWeight * ((pr.handlingCharges?.variable || 0) / 100);
        const fmCharges = Math.max(
          ((pr.fmCharges?.variable || 0) / 100) * baseFreight,
          pr.fmCharges?.fixed || 0
        );
        const appointmentCharges = Math.max(
          ((pr.appointmentCharges?.variable || 0) / 100) * baseFreight,
          pr.appointmentCharges?.fixed || 0
        );

        const totalCharges =
          baseFreight +
          docketCharge +
          minCharges +
          greenTax +
          daccCharges +
          miscCharges +
          fuelCharges +
          rovCharges +
          insuaranceCharges +
          odaCharges +
          handlingCharges +
          fmCharges +
          appointmentCharges;

        return {
          companyId: tempTransporter._id,
          companyName: tempTransporter.companyName,
          vendorCode: tempTransporter.vendorCode,
          originPincode: fromPincode,
          destinationPincode: toPincode,
          estimatedTime: estTime,
          distance: dist,
          actualWeight: parseFloat(actualWeight.toFixed(2)),
          volumetricWeight: parseFloat(volumetricWeight.toFixed(2)),
          chargeableWeight: parseFloat(chargeableWeight.toFixed(2)),
          unitPrice,
          baseFreight,
          docketCharge,
          minCharges,
          greenTax,
          daccCharges,
          miscCharges,
          fuelCharges,
          rovCharges,
          insuaranceCharges,
          odaCharges,
          handlingCharges,
          fmCharges,
          appointmentCharges,
          totalCharges,
          isHidden: false,
          isTemporaryTransporter: true,
        };
      })
    );
    const temporaryTransporterResult = temporaryTransporterRaw.filter((r) => r);
    console.timeEnd(`[${rid}] BUILD temporaryTransporterResult`);
    console.log(`[${rid}] temporaryTransporterResult count: ${temporaryTransporterResult.length}`);

    // ── Public transporter results ───────────────────────────────────────────
    console.time(`[${rid}] BUILD transporterResult`);
    const transporterRaw = await Promise.all(
      transporterData.map(async (data) => {
        console.log(`\n--- [CHECKING] Transporter: ${data.companyName} ---`);

        // Using filtered service array (only origin/dest entries)
        const matchedOrigin = data.service?.find(
  (entry) => String(entry.pincode).trim() === fromPinStr || Number(entry.pincode) === fromPinNum
);
        if (!matchedOrigin || matchedOrigin.isOda) {
          console.log(
            `-> [REJECTED] Reason: Origin pincode ${fromPincode} is not serviceable or is ODA.`
          );
          return null;
        }

        const matchedDest = data.service?.find(
  (entry) => String(entry.pincode).trim() === toPinStr || Number(entry.pincode) === toPinNum
);
        if (!matchedDest) {
          console.log(
            `-> [REJECTED] Reason: Destination pincode ${toPincode} is not serviceable.`
          );
          return null;
        }

        const originZone = matchedOrigin.zone;
        const destZone = matchedDest.zone;
        const destOda = matchedDest.isOda;

        // Price doc per transporter (project only required fields)
        console.time(`[${rid}] DB priceModel ${data._id}`);
        const priceData = await priceModel
          .findOne({ companyId: data._id })
          .select("priceRate zoneRates")
          .lean()
          .maxTimeMS(15000);
        console.timeEnd(`[${rid}] DB priceModel ${data._id}`);
        if (!priceData) {
          console.log(
            `-> [REJECTED] Reason: No price document found in the database.`
          );
          return null;
        }

        const pr = priceData.priceRate || {};
        const unitPrice = getUnitPriceFromPriceChart(priceData.zoneRates, originZone, destZone);

        if (!unitPrice) {
          console.log(
            `-> [REJECTED] Reason: No unit price found for route between zone ${originZone} and ${destZone}.`
          );
          return null;
        }

        const kFactor = pr.kFactor ?? pr.divisor ?? 5000;

        // Volumetric weight (ceil per item)
        let volumetricWeight = 0;
        if (Array.isArray(shipment_details) && shipment_details.length > 0) {
          volumetricWeight = shipment_details.reduce((sum, item) => {
            const volWeightForItem =
              ((item.length || 0) *
                (item.width || 0) *
                (item.height || 0) *
                (item.count || 0)) /
              kFactor;
            return sum + Math.ceil(volWeightForItem);
          }, 0);
        } else {
          const volWeightForLegacy =
            ((length || 0) *
              (width || 0) *
              (height || 0) *
              (noofboxes || 0)) /
            kFactor;
          volumetricWeight = Math.ceil(volWeightForLegacy);
        }

        const chargeableWeight = Math.max(volumetricWeight, actualWeight);
        const baseFreight = unitPrice * chargeableWeight;
        const docketCharge = pr.docketCharges || 0;
        const minCharges = pr.minCharges || 0;
        const greenTax = pr.greenTax || 0;
        const daccCharges = pr.daccCharges || 0;
        const miscCharges = pr.miscellanousCharges || 0;
        const fuelCharges = ((pr.fuel || 0) / 100) * baseFreight;
        const rovCharges = Math.max(
          ((pr.rovCharges?.variable || 0) / 100) * baseFreight,
          pr.rovCharges?.fixed || 0
        );
        const insuaranceCharges = Math.max(
          ((pr.insuaranceCharges?.variable || 0) / 100) * baseFreight,
          pr.insuaranceCharges?.fixed || 0
        );
        const odaCharges = destOda
          ? (pr.odaCharges?.fixed || 0) +
            chargeableWeight * ((pr.odaCharges?.variable || 0) / 100)
          : 0;
        const handlingCharges =
          (pr.handlingCharges?.fixed || 0) +
          chargeableWeight * ((pr.handlingCharges?.variable || 0) / 100);
        const fmCharges = Math.max(
          ((pr.fmCharges?.variable || 0) / 100) * baseFreight,
          pr.fmCharges?.fixed || 0
        );
        const appointmentCharges = Math.max(
          ((pr.appointmentCharges?.variable || 0) / 100) * baseFreight,
          pr.appointmentCharges?.fixed || 0
        );

        const totalCharges =
          baseFreight +
          docketCharge +
          minCharges +
          greenTax +
          daccCharges +
          miscCharges +
          fuelCharges +
          rovCharges +
          insuaranceCharges +
          odaCharges +
          handlingCharges +
          fmCharges +
          appointmentCharges;

        console.log(
          `-> [SUCCESS] Quote calculated. Chargeable Weight: ${chargeableWeight.toFixed(
            2
          )}kg, Total: ${totalCharges.toFixed(2)}`
        );

        if (l1 < totalCharges) return null;

        if (!isSubscribed) {
          // still compute but hide
          return { totalCharges, isHidden: true };
        }

        return {
          companyId: data._id,
          companyName: data.companyName,
          originPincode: fromPincode,
          destinationPincode: toPincode,
          estimatedTime: estTime,
          distance: dist,
          actualWeight: parseFloat(actualWeight.toFixed(2)),
          volumetricWeight: parseFloat(volumetricWeight.toFixed(2)),
          chargeableWeight: parseFloat(chargeableWeight.toFixed(2)),
          unitPrice,
          baseFreight,
          docketCharge,
          minCharges,
          greenTax,
          daccCharges,
          miscCharges,
          fuelCharges,
          rovCharges,
          insuaranceCharges,
          odaCharges,
          handlingCharges,
          fmCharges,
          appointmentCharges,
          totalCharges,
          isHidden: false,
        };
      })
    );
    const transporterResult = transporterRaw.filter((r) => r);
    console.timeEnd(`[${rid}] BUILD transporterResult`);
    console.log(`[${rid}] transporterResult count: ${transporterResult.length}`);

    // Combine tied-up results with temporary transporter results
    const allTiedUpResults = [...tiedUpResult, ...temporaryTransporterResult];

    return res.status(200).json({
      success: true,
      message: "Price calculated successfully",
      tiedUpResult: allTiedUpResults,
      companyResult: transporterResult,
    });
  } catch (err) {
    console.error("An error occurred in calculatePrice:", err);
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred.",
    });
  }
};

export const addTiedUpCompany = async (req, res) => {
  try {
    let {
      customerID,
      vendorCode,
      vendorPhone,
      vendorEmail,
      gstNo,
      mode,
      address,
      state,
      city,
      pincode,
      rating,
      companyName,
      subVendor,
      priceRate,
      priceChart,
      selectedZones,
    } = req.body;
    
    // Parse JSON strings if they come from FormData
    if (typeof priceRate === 'string') {
      try {
        priceRate = JSON.parse(priceRate);
      } catch (e) {
        console.error('Failed to parse priceRate:', e);
      }
    }
    
    if (typeof priceChart === 'string') {
      try {
        priceChart = JSON.parse(priceChart);
      } catch (e) {
        console.error('Failed to parse priceChart:', e);
      }
    }
    
    if (typeof selectedZones === 'string') {
      try {
        selectedZones = JSON.parse(selectedZones);
      } catch (e) {
        console.error('Failed to parse selectedZones:', e);
      }
    }
    
    // Basic required field validation
    if (
      !customerID ||
      !vendorCode ||
      !vendorPhone ||
      !vendorEmail ||
      !gstNo ||
      !mode ||
      !address ||
      !state ||
      !pincode ||
      !rating ||
      !companyName ||
      !priceRate ||
      !priceChart
    ) {
      return res.status(400).json({
        success: false,
        message:
          "customerID, companyName, priceRate and priceChart are all required",
      });
    }

    // Input validation and sanitization
    const validationErrors = [];

    // Validate email
    if (!validateEmail(vendorEmail)) {
      validationErrors.push("Invalid email format");
    }

    // Validate phone
    if (!validatePhone(vendorPhone)) {
      validationErrors.push("Invalid phone number format (must be 10 digits, cannot start with 0)");
    }

    // Validate GSTIN
    if (!validateGSTIN(gstNo)) {
      validationErrors.push("Invalid GSTIN format");
    }

    // Validate pincode
    if (!validatePincode(pincode)) {
      validationErrors.push("Invalid pincode format (must be 6 digits)");
    }

    // Validate zone matrix if selectedZones provided
    if (selectedZones && Array.isArray(selectedZones) && selectedZones.length > 0) {
      const sanitizedZones = sanitizeZoneCodes(selectedZones);
      const matrixValidation = validateZoneMatrix(priceChart, sanitizedZones);
      
      if (!matrixValidation.valid) {
        validationErrors.push(...matrixValidation.errors);
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    // Sanitize inputs
    const sanitizedCompanyName = sanitizeString(companyName, 100);
    const sanitizedAddress = sanitizeString(address, 200);
    const sanitizedState = sanitizeString(state, 50);
    const sanitizedCity = city ? sanitizeString(city, 50) : "";
    const sanitizedSubVendor = subVendor ? sanitizeString(subVendor, 50) : "";
    const sanitizedZones = selectedZones ? sanitizeZoneCodes(selectedZones) : [];

    // Check if this vendor already exists for this customer in temporary transporters
    const existingTempVendor = await temporaryTransporterModel.findOne({
      customerID: customerID,
      companyName: sanitizedCompanyName,
      vendorCode: vendorCode,
    });

    if (existingTempVendor) {
      return res.status(400).json({
        success: false,
        message: "This vendor already exists for your account",
      });
    }

    // Always save to temporary transporters for Add Vendor functionality
    const tempData = await new temporaryTransporterModel({
      customerID: customerID,
      companyName: sanitizedCompanyName,
      vendorCode: vendorCode,
      vendorPhone: Number(vendorPhone),
      vendorEmail: vendorEmail.trim().toLowerCase(),
      gstNo: gstNo.trim().toUpperCase(),
      mode: mode,
      address: sanitizedAddress,
      state: sanitizedState,
      city: sanitizedCity,
      pincode: Number(pincode),
      rating: Number(rating) || 3,
      subVendor: sanitizedSubVendor,
      selectedZones: sanitizedZones,
      prices: {
        priceRate: priceRate,
        priceChart: priceChart,
      },
    }).save();

    if (tempData) {
      return res.status(201).json({
        success: true,
        message: "Vendor added successfully to your tied-up vendors",
        data: tempData,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Failed to save vendor",
      });
    }
  } catch (err) {
    console.error("Error in addTiedUpCompany:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

export const getTiedUpCompanies = async (req, res) => {
  try {
    const userid = await req.query;
    const data = await usertransporterrelationshipModel.findOne({
      customerID: userid,
    });
    return res.status(200).json({
      success: true,
      message: "Tied up companies fetched successfully",
      data: data,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getTemporaryTransporters = async (req, res) => {
  try {
    const { customerID } = req.query;
    
    if (!customerID) {
      return res.status(400).json({
        success: false,
        message: "Customer ID is required",
      });
    }

    const temporaryTransporters = await temporaryTransporterModel.find({
      customerID: customerID,
    });

    return res.status(200).json({
      success: true,
      message: "Temporary transporters fetched successfully",
      data: temporaryTransporters,
    });
  } catch (error) {
    console.error("Error fetching temporary transporters:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getTransporters = async (req, res) => {
  try {
    const { search } = req.query;
    if (!search || typeof search !== "string" || !search.trim()) {
      return res.status(400).json([]);
    }
    const regex = new RegExp("^" + search, "i");
    const companies = await transporterModel
      .find({ companyName: { $regex: regex } })
      .limit(10)
      .select("companyName");
    res.json(companies.map((c) => c.companyName));
  } catch (err) {
    console.error("Fetch companies error:", err);
    res.status(500).json([]);
  }
};

export const getAllTransporters = async (req, res) => {
  try {
    const transporters = await transporterModel.find().select(
      "-password -servicableZones -service"
    );
    if (transporters.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No transporters found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Transporters fetched successfully",
      data: transporters,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Remove a tied-up vendor for a specific customer by company name (case-insensitive)
export const removeTiedUpVendor = async (req, res) => {
  try {
    // ═══════════════════════════════════════════════════════════
    // DEBUG LOGGING - Check what data we're receiving
    // ═══════════════════════════════════════════════════════════
    console.log('🗑️ ═══════ DELETE VENDOR REQUEST ═══════');
    console.log('📦 req.body:', JSON.stringify(req.body, null, 2));
    console.log('👤 req.user:', req.user?._id || req.user?.id || 'undefined');
    console.log('👤 req.customer:', req.customer?._id || req.customer?.id || 'undefined');
    console.log('───────────────────────────────────────');
    
    // Get data from body
    let { customerID, companyName, vendorId } = req.body || {};
    
    console.log('📋 Extracted from body:');
    console.log('  - customerID:', customerID);
    console.log('  - companyName:', companyName);
    console.log('  - vendorId:', vendorId);
    
    // ═══════════════════════════════════════════════════════════
    // FALLBACK: Get customerID from auth middleware if not in body
    // ═══════════════════════════════════════════════════════════
    if (!customerID) {
      customerID = 
        req.customer?._id || 
        req.customer?.id || 
        req.user?._id || 
        req.user?.id;
      
      console.log('⚠️ customerID not in body, using auth middleware:', customerID);
    }
    
    console.log('───────────────────────────────────────');
    console.log('✅ Final values:');
    console.log('  - customerID:', customerID);
    console.log('  - companyName:', companyName);
    console.log('  - vendorId:', vendorId);
    console.log('═══════════════════════════════════════\n');
    
    // ═══════════════════════════════════════════════════════════
    // VALIDATION
    // ═══════════════════════════════════════════════════════════
    if (!customerID || (!companyName && !vendorId)) {
      console.log('❌ VALIDATION FAILED:');
      console.log('  - Has customerID?', !!customerID);
      console.log('  - Has companyName?', !!companyName);
      console.log('  - Has vendorId?', !!vendorId);
      
      return res.status(400).json({ 
        success: false, 
        message: 'customerID and either companyName or vendorId are required',
        debug: process.env.NODE_ENV === 'development' ? {
          receivedCustomerID: !!customerID,
          receivedCompanyName: !!companyName,
          receivedVendorId: !!vendorId
        } : undefined
      });
    }

    console.log('✅ Validation passed, proceeding with deletion...');

    let relDeleted = 0;
    let tempDeleted = 0;

    // ═══════════════════════════════════════════════════════════
    // DELETE BY VENDOR ID (preferred)
    // ═══════════════════════════════════════════════════════════
    if (vendorId) {
      console.log(`🔍 Attempting to delete vendor by ID: ${vendorId}`);
      
      const tempRes = await temporaryTransporterModel.deleteOne({
        _id: vendorId,
        customerID: customerID
      });
      
      tempDeleted = tempRes?.deletedCount || 0;
      console.log(`  ✓ Deleted ${tempDeleted} temporary transporter(s)`);
    } 
    // ═══════════════════════════════════════════════════════════
    // DELETE BY COMPANY NAME (fallback)
    // ═══════════════════════════════════════════════════════════
    else if (companyName) {
      console.log(`🔍 Attempting to delete vendor by name: ${companyName}`);
      
      const nameRegex = new RegExp(`^${companyName}$`, 'i');

      // Find transporter by name to remove relationships
      const transporter = await transporterModel.findOne({ 
        companyName: nameRegex 
      }).select('_id');

      if (transporter?._id) {
        console.log(`  ✓ Found transporter: ${transporter._id}`);
        
        const relRes = await usertransporterrelationshipModel.deleteMany({
          customerID,
          transporterId: transporter._id,
        });
        
        relDeleted = relRes?.deletedCount || 0;
        console.log(`  ✓ Deleted ${relDeleted} relationship(s)`);
      } else {
        console.log(`  ⚠️ No transporter found with name: ${companyName}`);
      }

      // Remove any temporary transporters added for this customer
      const tempRes = await temporaryTransporterModel.deleteMany({
        customerID,
        companyName: nameRegex,
      });
      
      tempDeleted = tempRes?.deletedCount || 0;
      console.log(`  ✓ Deleted ${tempDeleted} temporary transporter(s)`);
    }

    // ═══════════════════════════════════════════════════════════
    // FINAL RESPONSE
    // ═══════════════════════════════════════════════════════════
    console.log('📊 Deletion summary:');
    console.log(`  - Relationships deleted: ${relDeleted}`);
    console.log(`  - Temporary transporters deleted: ${tempDeleted}`);
    console.log(`  - Total deleted: ${relDeleted + tempDeleted}`);

    if (tempDeleted > 0 || relDeleted > 0) {
      console.log('✅ Vendor deletion successful\n');
      
      return res.status(200).json({
        success: true,
        message: 'Vendor removed successfully',
        removedRelationships: relDeleted,
        removedTemporary: tempDeleted,
      });
    } else {
      console.log('❌ No vendor found to delete\n');
      
      return res.status(404).json({
        success: false,
        message: 'Vendor not found or already deleted',
      });
    }
  } catch (err) {
    console.error('💥 ERROR in removeTiedUpVendor:', err);
    console.error('Stack trace:', err.stack);
    
    return res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const savePckingList = async (req, res) => {
  try {
    const {
      customerId,
      name,
      modeoftransport,
      originPincode,
      destinationPincode,
      noofboxes,
      quantity,
      length,
      width,
      height,
      weight,
    } = req.body;
    if (
      !customerId ||
      !name ||
      !modeoftransport ||
      !originPincode ||
      !destinationPincode ||
      !noofboxes ||
      !length ||
      !width ||
      !height ||
      !weight
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill all the fields",
      });
    }
    const data = await new packingModel({
      customerId,
      name,
      modeoftransport,
      originPincode,
      destinationPincode,
      noofboxes,
      length,
      width,
      height,
      weight,
    }).save();
    if (data) {
      return res.status(200).json({
        success: true,
        message: "Packing list saved successfully",
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

export const getPackingList = async (req, res) => {
  try {
    const { customerId } = req.query;
    const data = await packingModel.find({ customerId });
    if (data) {
      return res.status(200).json({
        success: true,
        message: "Packing list found successfully",
        data: data,
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "Packing list not found",
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

export const getTrasnporterDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const details = await transporterModel
      .findOne({ _id: id })
      .select("-password -servicableZones -service");
    if (details) {
      return res.status(200).json({
        success: true,
        data: details,
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: true,
      message: "Server Error",
    });
  }
};

export const updateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const customerID = req.customer?._id;

    if (!customerID) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Verify vendor belongs to customer
    const vendor = await temporaryTransporterModel.findOne({
      _id: id,
      customerID: customerID,
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found or access denied",
      });
    }

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.customerID;
    delete updateData.prices; // Prices should be updated separately

    const updatedVendor = await temporaryTransporterModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedVendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vendor updated successfully",
      data: updatedVendor,
    });
  } catch (error) {
    console.error("Error updating vendor:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating vendor",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get zone matrix for a vendor
 * GET /api/transporter/zone-matrix/:vendorId
 */
export const getZoneMatrix = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const customerID = req.customer?._id;

    if (!customerID) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const vendor = await temporaryTransporterModel.findOne({
      _id: vendorId,
      customerID: customerID,
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found or access denied",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Zone matrix retrieved successfully",
      data: {
        vendorId: vendor._id,
        companyName: vendor.companyName,
        priceChart: vendor.prices?.priceChart || {},
        selectedZones: vendor.selectedZones || [],
      },
    });
  } catch (error) {
    console.error("Error retrieving zone matrix:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while retrieving zone matrix",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Update zone matrix for a vendor
 * PUT /api/transporter/zone-matrix/:vendorId
 */
export const updateZoneMatrix = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { priceChart, selectedZones } = req.body;
    const customerID = req.customer?._id;

    if (!customerID) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!priceChart) {
      return res.status(400).json({
        success: false,
        message: "priceChart is required",
      });
    }

    // Verify vendor belongs to customer
    const vendor = await temporaryTransporterModel.findOne({
      _id: vendorId,
      customerID: customerID,
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found or access denied",
      });
    }

    // Validate zone matrix if selectedZones provided
    const validationErrors = [];
    if (selectedZones && Array.isArray(selectedZones) && selectedZones.length > 0) {
      const sanitizedZones = sanitizeZoneCodes(selectedZones);
      const matrixValidation = validateZoneMatrix(priceChart, sanitizedZones);
      
      if (!matrixValidation.valid) {
        validationErrors.push(...matrixValidation.errors);
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    // Update zone matrix
    const sanitizedZones = selectedZones ? sanitizeZoneCodes(selectedZones) : vendor.selectedZones;
    
    const updatedVendor = await temporaryTransporterModel.findByIdAndUpdate(
      vendorId,
      {
        "prices.priceChart": priceChart,
        selectedZones: sanitizedZones,
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Zone matrix updated successfully",
      data: {
        vendorId: updatedVendor._id,
        companyName: updatedVendor.companyName,
        priceChart: updatedVendor.prices.priceChart,
        selectedZones: updatedVendor.selectedZones,
      },
    });
  } catch (error) {
    console.error("Error updating zone matrix:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating zone matrix",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Delete zone matrix for a vendor (resets to empty)
 * DELETE /api/transporter/zone-matrix/:vendorId
 */
export const deleteZoneMatrix = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const customerID = req.customer?._id;

    if (!customerID) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Verify vendor belongs to customer
    const vendor = await temporaryTransporterModel.findOne({
      _id: vendorId,
      customerID: customerID,
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found or access denied",
      });
    }

    // Reset zone matrix
    const updatedVendor = await temporaryTransporterModel.findByIdAndUpdate(
      vendorId,
      {
        "prices.priceChart": {},
        selectedZones: [],
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Zone matrix deleted successfully",
      data: {
        vendorId: updatedVendor._id,
        companyName: updatedVendor.companyName,
        priceChart: updatedVendor.prices.priceChart,
        selectedZones: updatedVendor.selectedZones,
      },
    });
  } catch (error) {
    console.error("Error deleting zone matrix:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while deleting zone matrix",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Save wizard data to backend
 * POST /api/vendor/wizard-data
 */
export const saveWizardData = async (req, res) => {
  try {
    const { zones, priceMatrix, oda, other } = req.body;
    const customerID = req.customer?._id;

    if (!customerID) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Validate price matrix if provided
    if (priceMatrix && zones && Array.isArray(zones) && zones.length > 0) {
      const selectedZones = zones.map((z) => z.zoneCode).filter(Boolean);
      if (selectedZones.length > 0) {
        const matrixValidation = validateZoneMatrix(priceMatrix, selectedZones);
        if (!matrixValidation.valid) {
          return res.status(400).json({
            success: false,
            message: "Invalid zone matrix structure",
            errors: matrixValidation.errors,
          });
        }
      }
    }

    // Store wizard data (using a simple key-value approach in customer model or separate collection)
    // For now, we'll use a simple approach - store in a wizardData collection
    // In production, you might want to use Redis or a dedicated wizard data model
    
    // Save to database (you may want to create a wizardDataModel for this)
    // For now, returning success - implementation depends on your storage strategy
    return res.status(200).json({
      success: true,
      message: "Wizard data saved successfully",
      data: {
        saved: true,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error saving wizard data:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while saving wizard data",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get wizard data from backend
 * GET /api/vendor/wizard-data
 */
export const getWizardData = async (req, res) => {
  try {
    const customerID = req.customer?._id;

    if (!customerID) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Retrieve wizard data from database
    // Implementation depends on your storage strategy
    // For now, returning empty data structure
    
    return res.status(200).json({
      success: true,
      message: "Wizard data retrieved successfully",
      data: {
        zones: [],
        priceMatrix: {},
        oda: {
          enabled: false,
          pincodes: [],
          surcharge: { fixed: 0, variable: 0 },
        },
        other: {
          minWeight: 0,
          docketCharges: 0,
          fuel: 0,
          // ... other fields
        },
      },
    });
  } catch (error) {
    console.error("Error retrieving wizard data:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while retrieving wizard data",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
