import haversineDistanceKm from '../src/utils/haversine.js';
import pinMap from '../src/utils/pincodeMap.js';

/**
 * Calculate distance between two pincodes using their actual coordinates
 * @param {string|number} originPincode - Origin pincode
 * @param {string|number} destinationPincode - Destination pincode
 * @returns {Object} Object containing distance in km and estimated time in days
 */
export const calculateDistanceBetweenPincode = async (originPincode, destinationPincode) => {
  try {
    const origin = String(originPincode);
    const destination = String(destinationPincode);
    
    // Get coordinates for both pincodes
    const originCoords = pinMap[origin];
    const destCoords = pinMap[destination];
    
    if (!originCoords) {
      console.warn(`Origin pincode ${origin} not found in pincode database`);
      return { estTime: "0", distance: "0 km" };
    }
    
    if (!destCoords) {
      console.warn(`Destination pincode ${destination} not found in pincode database`);
      return { estTime: "0", distance: "0 km" };
    }
    
    // Calculate distance using haversine formula
    const distanceKm = haversineDistanceKm(
      originCoords.lat,
      originCoords.lng,
      destCoords.lat,
      destCoords.lng
    );
    
    // Calculate estimated delivery time (rough estimate: 400km per day)
    const estTime = Math.max(1, Math.ceil(distanceKm / 400));
    
    return {
      estTime: estTime.toString(),
      distance: `${Math.round(distanceKm)} km`
    };
    
  } catch (error) {
    console.error('Error calculating distance between pincodes:', error);
    return { estTime: "0", distance: "0 km" };
  }
};

/**
 * Get coordinates for a pincode
 * @param {string|number} pincode - The pincode to get coordinates for
 * @returns {Object|null} Object with lat and lng, or null if not found
 */
export const getPincodeCoordinates = (pincode) => {
  const pincodeStr = String(pincode);
  return pinMap[pincodeStr] || null;
};
