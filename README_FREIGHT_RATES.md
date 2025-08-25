# Freight Rate System

This system allows you to upload a CSV file with freight rate data and calculate prices based on weight and distance.

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Upload CSV Data

Make sure your CSV file is located at: `C:\Users\Administrator\Downloads\freight_full_rate_table.csv`

Run the upload script:

```bash
npm run upload-freight-rates
```

This will:
- Read the CSV file
- Parse the data and extract vehicle, weight, and distance-based pricing
- Store the data in MongoDB
- Clear any existing freight rate data

### 3. Test the System

After uploading, test the calculation:

```bash
npm run test-freight-rates
```

This will test various weight and distance combinations to ensure the system is working correctly.

## API Endpoints

### Calculate Single Freight Rate
```
POST /api/freight-rate/calculate
Content-Type: application/json

{
  "weight": 1000,
  "distance": 500
}
```

Response:
```json
{
  "success": true,
  "message": "Freight rate calculated successfully",
  "data": {
    "vehicle": "Truck",
    "vehicleLength": 20,
    "inputWeight": 1000,
    "matchedWeight": 1000,
    "inputDistance": 500,
    "matchedDistance": 500,
    "price": 15000,
    "availableDistances": [100, 200, 300, 500, 1000]
  }
}
```

### Get Available Options
```
GET /api/freight-rate/options
```

Response:
```json
{
  "success": true,
  "message": "Available options retrieved successfully",
  "data": {
    "vehicles": ["Truck", "Container", "Trailer"],
    "weights": [1000, 2000, 5000, 10000, 20000],
    "distances": [100, 200, 300, 500, 1000, 2000, 3000]
  }
}
```

### Get Vehicle Pricing
```
GET /api/freight-rate/vehicle/Truck/weight/1000
```

Response:
```json
{
  "success": true,
  "message": "Vehicle pricing retrieved successfully",
  "data": {
    "vehicle": "Truck",
    "vehicleLength": 20,
    "weight": 1000,
    "pricing": {
      "100": 5000,
      "200": 8000,
      "300": 12000,
      "500": 15000,
      "1000": 25000
    }
  }
}
```

### Calculate Multiple Shipments
```
POST /api/freight-rate/calculate-multiple
Content-Type: application/json

{
  "shipments": [
    { "weight": 1000, "distance": 500 },
    { "weight": 5000, "distance": 1000 }
  ]
}
```

### Get Statistics
```
GET /api/freight-rate/stats
```

## CSV File Format

The CSV file should have the following structure:

| Vehicle | Vehicle Length (ft) | Weight (Kg) | 100 km | 200 km | 300 km | 500 km | 1000 km |
|---------|-------------------|-------------|--------|--------|--------|--------|---------|
| Truck   | 20               | 1000        | 5000   | 8000   | 12000  | 15000  | 25000   |
| Container | 40             | 5000        | 15000  | 25000  | 35000  | 45000  | 75000   |

## How It Works

1. **Weight Matching**: The system finds the nearest weight match in the database
2. **Distance Matching**: For the matched weight, it finds the nearest distance slab
3. **Price Calculation**: Returns the price for the matched weight and distance combination

## Integration with Calculator

The freight rate system has been integrated into your existing calculator! Here's what changed:

### ✅ **What's Integrated:**

1. **FTL and Wheelseye FTL** now use CSV-based pricing instead of hardcoded values
2. **Real-time calculation** based on actual weight and distance from your CSV data
3. **Enhanced shipment info** showing vehicle type, length, and matched weight/distance
4. **Fallback handling** if CSV data is unavailable

### 🔧 **How It Works:**

1. **Weight Matching**: Finds the nearest weight match in your CSV data
2. **Distance Matching**: Finds the nearest distance slab for the matched weight
3. **Price Calculation**: Returns accurate pricing from your CSV
4. **FTL Pricing**: Uses the CSV price directly
5. **Wheelseye Pricing**: 20% less than FTL price

### 📊 **Enhanced Display:**

For FTL and Wheelseye vendors, the calculator now shows:
- Vehicle Type (from CSV)
- Vehicle Length (from CSV)
- Matched Weight (nearest weight in CSV)
- Matched Distance (nearest distance in CSV)
- Accurate pricing based on your rate table

### 🚀 **Setup Steps:**

1. **Upload your CSV:**
   ```bash
   npm run upload-freight-rates
   ```

2. **Test the integration:**
   ```bash
   npm run test-integration
   ```

3. **Start your calculator** - FTL and Wheelseye will now use CSV data!

### 🔄 **API Integration:**

The calculator automatically calls:
- `POST /api/freight-rate/calculate` for FTL pricing
- Uses the same API for Wheelseye (with 20% discount)
- Falls back gracefully if CSV data is unavailable

## Error Handling

The system handles various error scenarios:
- Missing or invalid weight/distance
- No matching data found
- Database connection issues
- CSV parsing errors

## Database Schema

The freight rate data is stored in MongoDB with the following structure:

```javascript
{
  vehicle: String,
  vehicleLength: Number,
  weight: Number,
  distancePricing: Map<String, Number>, // distance -> price
  originalData: Object, // original CSV row
  createdAt: Date,
  updatedAt: Date
}
```

## Troubleshooting

1. **CSV not found**: Ensure the file path is correct
2. **Database connection**: Check MongoDB connection string
3. **No results**: Verify CSV format and data
4. **Calculation errors**: Check weight and distance ranges in your data
