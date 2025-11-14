/**
 * Chargeable Weight Calculation Service
 * 
 * Calculates chargeable weight based on:
 * - Actual Weight: Sum of (Box Weight × Quantity)
 * - Volumetric Weight: (L × W × H × Quantity) ÷ kFactor
 * - Chargeable Weight: Maximum of Actual vs Volumetric Weight
 * 
 * kFactor = 5000 for all modes (as per requirement)
 */

/**
 * Calculate chargeable weight for shipment details
 * @param {Array} shipmentDetails - Array of box objects with weight, length, width, height, count
 * @param {number} kFactor - Volumetric divisor (default: 5000)
 * @returns {Object} Weight breakdown object
 */
function calculateChargeableWeight(shipmentDetails, kFactor = 5000) {
  try {
    // Calculate actual weight
    const actualWeight = shipmentDetails.reduce(
      (sum, box) => sum + (box.weight || 0) * (box.count || 0),
      0
    );

    // Calculate volumetric weight
    const volumetricWeight = shipmentDetails.reduce(
      (sum, box) => {
        const volume = (box.length || 0) * (box.width || 0) * (box.height || 0) * (box.count || 0);
        return sum + (volume / kFactor);
      },
      0
    );

    // Chargeable weight is the higher of actual weight and volumetric weight
    const chargeableWeight = Math.max(actualWeight, volumetricWeight);

    return {
      actualWeight: parseFloat(actualWeight.toFixed(2)),
      volumetricWeight: parseFloat(volumetricWeight.toFixed(2)),
      chargeableWeight: parseFloat(chargeableWeight.toFixed(2)),
      kFactor: kFactor,
      weightType: actualWeight > volumetricWeight ? 'actual' : 'volumetric'
    };
  } catch (error) {
    console.error('Error calculating chargeable weight:', error);
    throw new Error('Failed to calculate chargeable weight');
  }
}

/**
 * Calculate chargeable weight for a single box
 * @param {Object} box - Box object with weight, length, width, height, count
 * @param {number} kFactor - Volumetric divisor (default: 5000)
 * @returns {Object} Weight breakdown object
 */
function calculateSingleBoxChargeableWeight(box, kFactor = 5000) {
  try {
    const actualWeight = (box.weight || 0) * (box.count || 0);
    const volume = (box.length || 0) * (box.width || 0) * (box.height || 0) * (box.count || 0);
    const volumetricWeight = volume / kFactor;
    const chargeableWeight = Math.max(actualWeight, volumetricWeight);

    return {
      actualWeight: parseFloat(actualWeight.toFixed(2)),
      volumetricWeight: parseFloat(volumetricWeight.toFixed(2)),
      chargeableWeight: parseFloat(chargeableWeight.toFixed(2)),
      kFactor: kFactor,
      weightType: actualWeight > volumetricWeight ? 'actual' : 'volumetric'
    };
  } catch (error) {
    console.error('Error calculating single box chargeable weight:', error);
    throw new Error('Failed to calculate single box chargeable weight');
  }
}

/**
 * Validate shipment details for weight calculation
 * @param {Array} shipmentDetails - Array of box objects
 * @returns {boolean} Validation result
 */
function validateShipmentDetails(shipmentDetails) {
  if (!Array.isArray(shipmentDetails)) {
    return false;
  }

  return shipmentDetails.every(box => {
    return (
      typeof box === 'object' &&
      box !== null &&
      typeof box.weight === 'number' && box.weight >= 0 &&
      typeof box.length === 'number' && box.length >= 0 &&
      typeof box.width === 'number' && box.width >= 0 &&
      typeof box.height === 'number' && box.height >= 0 &&
      typeof box.count === 'number' && box.count >= 0
    );
  });
}

export {
  calculateChargeableWeight,
  calculateSingleBoxChargeableWeight,
  validateShipmentDetails
};
