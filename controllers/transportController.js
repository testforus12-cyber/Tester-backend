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
import haversineDistanceKm from "../src/utils/haversine.js";
import pinMap from "../src/utils/pincodeMap.js";

dotenv.config();

/** Helper: robust access to zoneRates whether Map or plain object */
function getUnitPriceFromChart(zoneRates, originZone, destZone) {
  if (!zoneRates) return undefined;
  if (typeof zoneRates.get === "function") {
    const row = zoneRates.get(originZone);
    return row ? row[destZone] : undefined;
  }
  const row = zoneRates[originZone];
  return row ? row[destZone] : undefined;
}

export const deletePackingList = async (req, res) => {
  try {
    const preset = await PackingList.findById(req.params.id);
    if (!preset) return res.status(404).json({ message: "Preset not found" });
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
    console.log(
      "Google Maps API failed, using pincode coordinates fallback:",
      error.message
    );
    try {
      const originStr = String(origin);
      const destStr = String(destination);
      const originCoords = pinMap[originStr];
      const destCoords = pinMap[destStr];
      if (!originCoords || !destCoords) {
        console.warn(
          `Pincode coordinates not found for ${originStr} or ${destStr}`
        );
        return { estTime: "1", distance: "100 km" };
      }
      const distanceKm = haversineDistanceKm(
        originCoords.lat,
        originCoords.lng,
        destCoords.lat,
        destCoords.lng
      );
      const estTime = Math.max(1, Math.ceil(distanceKm / 400));
      return { estTime: estTime.toString(), distance: `${Math.round(distanceKm)} km` };
    } catch (fallbackError) {
      console.error("Fallback distance calculation also failed:", fallbackError);
      return { estTime: "1", distance: "100 km" };
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

  const fromPin = Number(fromPincode);
  const toPin = Number(toPincode);

  try {
    // ── DB fetches timed & optimized ─────────────────────────────────────────
    console.time(`[${rid}] DB tiedUpCompanies`);
    const tiedUpCompanies = await usertransporterrelationshipModel
      .find({ customerID })
      .select("customerID transporterId prices")
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

    console.time(`[${rid}] DB transporters`);
    const transporterData = await transporterModel
      .aggregate([
        {
          $match: {
            service: {
              $all: [
                { $elemMatch: { pincode: fromPin } },
                { $elemMatch: { pincode: toPin } },
              ],
            },
          },
        },
        {
          $project: {
            companyName: 1,
            service: {
              $filter: {
                input: "$service",
                as: "s",
                cond: {
                  $or: [
                    { $eq: ["$$s.pincode", fromPin] },
                    { $eq: ["$$s.pincode", toPin] },
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

    // NEW: batch fetch all price docs in one go (replaces N x findOne)
    const ids = transporterData.map((t) => t._id);
    console.time(`[${rid}] DB priceModel batch`);
    const priceDocs = await priceModel
      .find({ companyId: { $in: ids } })
      .select("companyId priceRate zoneRates")
      .lean()
      .maxTimeMS(15000);
    console.timeEnd(`[${rid}] DB priceModel batch`);
    console.log(`[${rid}] priceDocs fetched: ${priceDocs.length}`);

    const priceById = new Map(
      priceDocs.map((d) => [String(d.companyId), d])
    );

    let l1 = Number.MAX_SAFE_INTEGER;

    // ── Tied-up companies (unchanged path; usually small) ────────────────────
    console.time(`[${rid}] BUILD tiedUpResult`);
    const tiedUpRaw = await Promise.all(
      tiedUpCompanies.map(async (tuc) => {
        console.time(`[${rid}] DB transporterById ${tuc.transporterId}`);
        const transporter = await transporterModel
          .findById(tuc.transporterId)
          .select("companyName service")
          .lean()
          .maxTimeMS(15000);
        console.timeEnd(`[${rid}] DB transporterById ${tuc.transporterId}`);
        if (!transporter) return null;

        const doesExist = tuc.prices?.priceChart?.[fromPincode];
        if (!doesExist) return null;

        const matchedOrigin = transporter.service?.find(
          (entry) => entry.pincode === fromPin
        );
        if (!matchedOrigin || matchedOrigin.isOda) return null;

        const matchedDest = transporter.service?.find(
          (entry) => entry.pincode === toPin
        );
        if (!matchedDest) return null;

        const destZone = matchedDest.zone;
        const destIsOda = matchedDest.isOda;
        const unitPrice = tuc.prices.priceChart[fromPincode]?.[destZone];
        if (!unitPrice) return null;

        const pr = tuc.prices.priceRate || {};
        const kFactor = pr.kFactor ?? pr.divisor ?? 5000;

        let volumetricWeight = 0;
        if (Array.isArray(shipment_details) && shipment_details.length > 0) {
          volumetricWeight = shipment_details.reduce((sum, item) => {
            const v =
              ((item.length || 0) *
                (item.width || 0) *
                (item.height || 0) *
                (item.count || 0)) /
              kFactor;
            return sum + Math.ceil(v);
          }, 0);
        } else {
          const v =
            ((length || 0) * (width || 0) * (height || 0) * (noofboxes || 0)) /
            kFactor;
          volumetricWeight = Math.ceil(v);
        }

        const chargeableWeight = Math.max(volumetricWeight, actualWeight);
        const baseFreight = unitPrice * chargeableWeight;
        const docketCharge = tuc.prices?.priceRate?.docketCharges || 0;
        const minCharges = tuc.prices?.priceRate?.minCharges || 0;
        const greenTax = tuc.prices?.priceRate?.greenTax || 0;
        const daccCharges = tuc.prices?.priceRate?.daccCharges || 0;
        const miscCharges = tuc.prices?.priceRate?.miscellanousCharges || 0;
        const fuelCharges =
          ((tuc.prices?.priceRate?.fuel || 0) / 100) * baseFreight;
        const rovCharges = Math.max(
          (((tuc.prices?.priceRate?.rovCharges?.variable || 0) / 100) *
            baseFreight),
          tuc.prices?.priceRate?.rovCharges?.fixed || 0
        );
        const insuaranceCharges = Math.max(
          (((tuc.prices?.priceRate?.insuaranceCharges?.variable || 0) / 100) *
            baseFreight),
          tuc.prices?.priceRate?.insuaranceCharges?.fixed || 0
        );
        const odaCharges = destIsOda
          ? (tuc.prices?.priceRate?.odaCharges?.fixed || 0) +
            chargeableWeight *
              ((tuc.prices?.priceRate?.odaCharges?.variable || 0) / 100)
          : 0;
        const handlingCharges =
          (tuc.prices?.priceRate?.handlingCharges?.fixed || 0) +
          chargeableWeight *
            ((tuc.prices?.priceRate?.handlingCharges?.variable || 0) / 100);
        const fmCharges = Math.max(
          (((tuc.prices?.priceRate?.fmCharges?.variable || 0) / 100) *
            baseFreight),
          tuc.prices?.priceRate?.fmCharges?.fixed || 0
        );
        const appointmentCharges = Math.max(
          (((tuc.prices?.priceRate?.appointmentCharges?.variable || 0) / 100) *
            baseFreight),
          tuc.prices?.priceRate?.appointmentCharges?.fixed || 0
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
          companyId: transporter._id,
          companyName: transporter.companyName,
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

    // ── Public transporter results (now using batch price docs) ──────────────
    console.time(`[${rid}] BUILD transporterResult`);
    const transporterRaw = await Promise.all(
      transporterData.map(async (data) => {
        console.log(`\n--- [CHECKING] Transporter: ${data.companyName} ---`);

        const matchedOrigin = data.service?.find(
          (entry) => entry.pincode === fromPin
        );
        if (!matchedOrigin || matchedOrigin.isOda) {
          console.log(
            `-> [REJECTED] Reason: Origin pincode ${fromPincode} is not serviceable or is ODA.`
          );
          return null;
        }

        const matchedDest = data.service?.find(
          (entry) => entry.pincode === toPin
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

        const priceData = priceById.get(String(data._id));
        if (!priceData) {
          console.log(
            `-> [REJECTED] Reason: No price document found in the database.`
          );
          return null;
        }

        const pr = priceData.priceRate || {};
        const unitPrice = getUnitPriceFromChart(
          priceData.zoneRates,
          originZone,
          destZone
        );
        if (!unitPrice) {
          console.log(
            `-> [REJECTED] Reason: No unit price found for route between zone ${originZone} and ${destZone}.`
          );
          return null;
        }

        const kFactor = pr.kFactor ?? pr.divisor ?? 5000;

        let volumetricWeight = 0;
        if (Array.isArray(shipment_details) && shipment_details.length > 0) {
          volumetricWeight = shipment_details.reduce((sum, item) => {
            const v =
              ((item.length || 0) *
                (item.width || 0) *
                (item.height || 0) *
                (item.count || 0)) /
              kFactor;
            return sum + Math.ceil(v);
          }, 0);
        } else {
          const v =
            ((length || 0) * (width || 0) * (height || 0) * (noofboxes || 0)) /
            kFactor;
          volumetricWeight = Math.ceil(v);
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
        if (!isSubscribed) return { totalCharges, isHidden: true };

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

    return res.status(200).json({
      success: true,
      message: "Price calculated successfully",
      tiedUpResult,
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
    const {
      customerID,
      vendorCode,
      vendorPhone,
      vendorEmail,
      gstNo,
      mode,
      address,
      state,
      pincode,
      rating,
      companyName,
      priceRate,
      priceChart,
    } = req.body;
    if (
      (!customerID,
      !vendorCode,
      !vendorPhone,
      !vendorEmail,
      !gstNo,
      !mode,
      !address,
      !state,
      !pincode,
      !rating,
      !companyName,
      !priceRate,
      !priceChart)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "customerID, companyName, priceRate and priceChart file are all required",
      });
    }

    const companyId = await transporterModel.findOne({ companyName: companyName });
    if (!companyId) {
      const tempData = new temporaryTransporterModel({
        customerID: customerID,
        companyName: companyName,
        vendorCode: vendorCode,
        vendorPhone: vendorPhone,
        vendorEmail: vendorEmail,
        gstNo: gstNo,
        mode: mode,
        address: address,
        state: state,
        pincode: pincode,
        prices: {
          priceRate: priceRate,
          priceChart: priceChart,
        },
      }).save();
      if (tempData) {
        return res.status(201).json({
          success: true,
          message: "Company added for verification",
        });
      }
    }

    const newDoc = new usertransporterrelationshipModel({
      customerID: customerID,
      transporterId: companyId._id,
      prices: {
        vendorCode: vendorCode,
        vendorPhone: vendorPhone,
        vendorEmail: vendorEmail,
        gstNo: gstNo,
        mode: mode,
        address: address,
        state: state,
        pincode: pincode,
        priceRate: priceRate,
        priceChart: priceChart,
      },
    });
    await newDoc.save();

    const ratingData = await ratingModel.findOne({ companyId: companyId._id });
    if (!ratingData) {
      const ratingPayload = {
        companyId: companyId._id,
        sum: rating,
        noofreviews: 1,
        rating: rating,
      };
      await new ratingModel(ratingPayload).save();
    } else {
      let ratingSum = ratingData.sum;
      let ratingReviews = ratingData.noofreviews;
      ratingSum += rating;
      ratingReviews += 1;
      const newRating = ratingSum / ratingReviews;

      ratingData.sum = ratingSum;
      ratingData.noofreviews = ratingReviews;
      ratingData.rating = newRating;
      await ratingData.save();
    }

    return res.status(200).json({
      success: true,
      message: "Tied up company added successfully",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error",
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
    const transporters = await transporterModel
      .find()
      .select("-password -servicableZones -service");
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
