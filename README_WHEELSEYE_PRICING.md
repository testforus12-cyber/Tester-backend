# Wheelseye Pricing System

This document describes the Wheelseye pricing system implementation for the freight comparison application.

## Overview

The Wheelseye pricing system provides accurate freight rate calculations based on weight and distance ranges for different vehicle types. The system is designed to handle 11 different vehicle configurations with specific weight and distance constraints.

## Vehicle Types and Specifications

### 1. Tata Ace (850-1000kg, 0-1000km)
- **Weight Range**: 850-1000kg
- **Distance Range**: 0-1000km
- **Vehicle Length**: 7 ft
- **Pricing Range**: ₹4,300 to ₹18,500

### 2. Pickup (1001-1200kg, 0-1000km)
- **Weight Range**: 1001-1200kg
- **Distance Range**: 0-1000km
- **Vehicle Length**: 8 ft
- **Pricing Range**: ₹5,300 to ₹23,100

### 3. 10ft Truck (1201-1500kg, 0-1000km)
- **Weight Range**: 1201-1500kg
- **Distance Range**: 0-1000km
- **Vehicle Length**: 10 ft
- **Pricing Range**: ₹2,200 to ₹29,300

### 4. Eicher 14 ft (1501-2000kg, 0-2000km)
- **Weight Range**: 1501-2000kg
- **Distance Range**: 0-2000km
- **Vehicle Length**: 14 ft
- **Pricing Range**: ₹3,600 to ₹50,800

### 5. Eicher 14 ft (2001-2500kg, 0-2200km)
- **Weight Range**: 2001-2500kg
- **Distance Range**: 0-2200km
- **Vehicle Length**: 14 ft
- **Pricing Range**: ₹3,600 to ₹67,500

### 6. Eicher 14 ft (2501-3000kg, 0-2500km)
- **Weight Range**: 2501-3000kg
- **Distance Range**: 0-2500km
- **Vehicle Length**: 14 ft
- **Pricing Range**: ₹3,600 to ₹67,500

### 7. Eicher 14 ft (3001-3500kg, 0-2700km)
- **Weight Range**: 3001-3500kg
- **Distance Range**: 0-2700km
- **Vehicle Length**: 14 ft
- **Pricing Range**: ₹3,600 to ₹79,100

### 8. Eicher 14 ft (3501-4000kg, 0-2200km)
- **Weight Range**: 3501-4000kg
- **Distance Range**: 0-2200km
- **Vehicle Length**: 14 ft
- **Pricing Range**: ₹3,600 to ₹67,500

### 9. Eicher 19 ft (4001-7000kg, 0-2700km)
- **Weight Range**: 4001-7000kg
- **Distance Range**: 0-2700km
- **Vehicle Length**: 19 ft
- **Pricing Range**: ₹6,000 to ₹98,200

### 10. Eicher 20 ft (7001-10000kg, 0-2700km)
- **Weight Range**: 7001-10000kg
- **Distance Range**: 0-2700km
- **Vehicle Length**: 20 ft
- **Pricing Range**: ₹10,800 to ₹107,900

### 11. Container 32 ft MXL (10001-18000kg, 0-2700km)
- **Weight Range**: 10001-18000kg
- **Distance Range**: 0-2700km
- **Vehicle Length**: 32 ft
- **Pricing Range**: ₹15,400 to ₹148,400



## Database Schema

### WheelseyePricing Model

```javascript
{
  vehicleType: String, // Enum of vehicle types
  weightRange: {
    min: Number,
    max: Number
  },
  distanceRange: {
    min: Number,
    max: Number
  },
  vehicleLength: Number,
  pricing: [{
    distanceRange: {
      min: Number,
      max: Number
    },
    price: Number
  }],
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints

### Public Endpoints

#### 1. Get Pricing by Weight and Distance
```
GET /api/wheelseye/pricing?weight=1000&distance=500
```

**Response:**
```json
{
  "success": true,
  "data": {
    "vehicle": "Tata Ace",
    "vehicleLength": 7,
    "matchedWeight": 1000,
    "matchedDistance": 500,
    "price": 13900
  }
}
```

#### 2. Get All Vehicle Types
```
GET /api/wheelseye/vehicles
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "vehicleType": "Tata Ace",
      "weightRange": { "min": 850, "max": 1000 },
      "distanceRange": { "min": 0, "max": 1000 },
      "vehicleLength": 7
    }
  ]
}
```

#### 3. Get Vehicle Pricing Details
```
GET /api/wheelseye/vehicle/Tata%20Ace
```

**Response:**
```json
{
  "success": true,
  "data": {
    "vehicleType": "Tata Ace",
    "weightRange": { "min": 850, "max": 1000 },
    "distanceRange": { "min": 0, "max": 1000 },
    "vehicleLength": 7,
    "pricing": [
      {
        "distanceRange": { "min": 0, "max": 100 },
        "price": 4300
      }
    ]
  }
}
```

### Admin Endpoints

#### 1. Get All Pricing Data
```
GET /api/wheelseye/admin/all
```

#### 2. Update Pricing Record
```
PUT /api/wheelseye/admin/:id
```

#### 3. Delete Pricing Record
```
DELETE /api/wheelseye/admin/:id
```

## Installation and Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Upload Pricing Data
```bash
npm run upload-wheelseye-pricing
```

### 3. Test the System
```bash
npm run test-wheelseye-pricing
```

## Usage Examples

### Frontend Integration

```javascript
// Get Wheelseye pricing
const getWheelseyePrice = async (weight, distance) => {
  try {
    const response = await fetch(`/api/wheelseye/pricing?weight=${weight}&distance=${distance}`);
    const data = await response.json();
    
    if (data.success) {
      return data.data;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Error fetching Wheelseye pricing:', error);
    throw error;
  }
};

// Usage
const pricing = await getWheelseyePrice(1000, 500);
console.log(`Vehicle: ${pricing.vehicle}, Price: ₹${pricing.price}`);
```

### Backend Integration

```javascript
const WheelseyePricing = require('./model/wheelseyePricingModel');

// Get pricing directly
const pricing = await WheelseyePricing.findPricing(1000, 500);
console.log(pricing);
```

## Error Handling

The system handles various error scenarios:

1. **Invalid Weight/Distance**: Returns 400 error for negative or zero values
2. **Out of Range**: Returns error when weight/distance is outside supported ranges
3. **No Vehicle Found**: Returns error when no suitable vehicle is found
4. **No Pricing Found**: Returns error when no pricing is available for the given distance

## Performance Considerations

- The system uses MongoDB indexes for efficient queries
- Pricing calculations are optimized for quick lookups
- The database schema is designed for minimal query complexity

## Maintenance

### Updating Pricing Data

1. Modify the pricing data in `backend/scripts/uploadWheelseyePricing.js`
2. Run the upload script to update the database
3. Test the changes using the test script

### Adding New Vehicle Types

1. Add the new vehicle type to the enum in the model
2. Add pricing data to the upload script
3. Update the frontend logic if needed
4. Test thoroughly

## Troubleshooting

### Common Issues

1. **Database Connection**: Ensure MongoDB is running
2. **Data Not Found**: Run the upload script to populate data
3. **Invalid Queries**: Check weight and distance parameters
4. **CORS Issues**: Verify CORS configuration in the backend

### Debug Commands

```bash
# Check database connection
npm run test-wheelseye-pricing

# View all pricing data
curl https://tester-backend-4nxc.onrender.com/api/wheelseye/admin/all

# Test specific pricing
curl "https://tester-backend-4nxc.onrender.com/api/wheelseye/pricing?weight=1000&distance=500"
```

## Future Enhancements

1. **Dynamic Pricing**: Support for real-time pricing updates
2. **Seasonal Rates**: Support for seasonal pricing variations
3. **Bulk Operations**: API endpoints for bulk pricing calculations
4. **Analytics**: Pricing analytics and reporting features
5. **Integration**: Integration with external pricing APIs

## Support

For issues or questions regarding the Wheelseye pricing system, please refer to the main project documentation or contact the development team.
