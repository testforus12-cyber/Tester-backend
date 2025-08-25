import mongoose from 'mongoose';
import WheelseyePricing from '../model/wheelseyePricingModel.js';
import dotenv from 'dotenv';

console.log('🚀 Starting Wheelseye pricing upload script...');

dotenv.config();

// MongoDB connection
const connectDB = async () => {
  try {
    const url = process.env.MONGO_DB_URL || 'mongodb://localhost:27017/freight_compare';
    console.log('Attempting to connect to MongoDB...');
    console.log('URL:', url);
    
    await mongoose.connect(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Wheelseye pricing data
const wheelseyePricingData = [
  {
    vehicleType: 'Tata Ace',
    weightRange: { min: 850, max: 1000 },
    distanceRange: { min: 0, max: 1000 },
    vehicleLength: 7,
    pricing: [
      { distanceRange: { min: 0, max: 100 }, price: 4300 },
      { distanceRange: { min: 101, max: 150 }, price: 6000 },
      { distanceRange: { min: 151, max: 200 }, price: 6900 },
      { distanceRange: { min: 201, max: 250 }, price: 7000 },
      { distanceRange: { min: 251, max: 300 }, price: 9500 },
      { distanceRange: { min: 301, max: 350 }, price: 10400 },
      { distanceRange: { min: 351, max: 400 }, price: 10400 },
      { distanceRange: { min: 401, max: 450 }, price: 10600 },
      { distanceRange: { min: 451, max: 500 }, price: 13900 },
      { distanceRange: { min: 501, max: 600 }, price: 12300 },
      { distanceRange: { min: 601, max: 700 }, price: 15700 },
      { distanceRange: { min: 701, max: 800 }, price: 17900 },
      { distanceRange: { min: 801, max: 900 }, price: 18400 },
      { distanceRange: { min: 901, max: 1000 }, price: 18500 }
    ]
  },
  {
    vehicleType: 'Pickup',
    weightRange: { min: 1001, max: 1200 },
    distanceRange: { min: 0, max: 1000 },
    vehicleLength: 8,
    pricing: [
      { distanceRange: { min: 0, max: 100 }, price: 5300 },
      { distanceRange: { min: 101, max: 150 }, price: 6500 },
      { distanceRange: { min: 151, max: 200 }, price: 7000 },
      { distanceRange: { min: 201, max: 250 }, price: 7300 },
      { distanceRange: { min: 251, max: 300 }, price: 11500 },
      { distanceRange: { min: 301, max: 350 }, price: 11400 },
      { distanceRange: { min: 351, max: 400 }, price: 11400 },
      { distanceRange: { min: 401, max: 450 }, price: 10500 },
      { distanceRange: { min: 451, max: 500 }, price: 12800 },
      { distanceRange: { min: 501, max: 600 }, price: 15700 },
      { distanceRange: { min: 601, max: 700 }, price: 16900 },
      { distanceRange: { min: 701, max: 800 }, price: 17000 },
      { distanceRange: { min: 801, max: 900 }, price: 22600 },
      { distanceRange: { min: 901, max: 1000 }, price: 23100 }
    ]
  },
  {
    vehicleType: '10 ft Truck',
    weightRange: { min: 1201, max: 1500 },
    distanceRange: { min: 0, max: 1000 },
    vehicleLength: 10,
    pricing: [
      { distanceRange: { min: 0, max: 50 }, price: 2200 },
      { distanceRange: { min: 51, max: 60 }, price: 2200 },
      { distanceRange: { min: 61, max: 100 }, price: 5800 },
      { distanceRange: { min: 101, max: 150 }, price: 4900 },
      { distanceRange: { min: 151, max: 200 }, price: 9800 },
      { distanceRange: { min: 201, max: 250 }, price: 9600 },
      { distanceRange: { min: 251, max: 300 }, price: 11500 },
      { distanceRange: { min: 301, max: 350 }, price: 12000 },
      { distanceRange: { min: 351, max: 400 }, price: 13000 },
      { distanceRange: { min: 401, max: 450 }, price: 14600 },
      { distanceRange: { min: 451, max: 500 }, price: 16400 },
      { distanceRange: { min: 501, max: 600 }, price: 20300 },
      { distanceRange: { min: 601, max: 700 }, price: 23000 },
      { distanceRange: { min: 701, max: 800 }, price: 25200 },
      { distanceRange: { min: 801, max: 900 }, price: 29300 },
      { distanceRange: { min: 901, max: 1000 }, price: 2100 }
    ]
  },
  {
    vehicleType: 'Eicher 14 ft',
    weightRange: { min: 1501, max: 2000 },
    distanceRange: { min: 0, max: 2000 },
    vehicleLength: 14,
    pricing: [
      { distanceRange: { min: 0, max: 50 }, price: 3600 },
      { distanceRange: { min: 51, max: 60 }, price: 3600 },
      { distanceRange: { min: 61, max: 100 }, price: 7200 },
      { distanceRange: { min: 101, max: 150 }, price: 9200 },
      { distanceRange: { min: 151, max: 200 }, price: 12600 },
      { distanceRange: { min: 201, max: 250 }, price: 12200 },
      { distanceRange: { min: 251, max: 300 }, price: 18000 },
      { distanceRange: { min: 301, max: 350 }, price: 17800 },
      { distanceRange: { min: 351, max: 400 }, price: 17800 },
      { distanceRange: { min: 401, max: 450 }, price: 21000 },
      { distanceRange: { min: 451, max: 500 }, price: 22600 },
      { distanceRange: { min: 501, max: 600 }, price: 20500 },
      { distanceRange: { min: 601, max: 700 }, price: 28200 },
      { distanceRange: { min: 701, max: 800 }, price: 29300 },
      { distanceRange: { min: 801, max: 900 }, price: 28800 },
      { distanceRange: { min: 901, max: 1000 }, price: 36900 },
      { distanceRange: { min: 1001, max: 1200 }, price: 37700 },
      { distanceRange: { min: 1201, max: 1500 }, price: 50800 },
      { distanceRange: { min: 1501, max: 1800 }, price: 45900 },
      { distanceRange: { min: 1801, max: 2000 }, price: 45900 }
    ]
  },
  {
    vehicleType: 'Eicher 14 ft',
    weightRange: { min: 2001, max: 2500 },
    distanceRange: { min: 0, max: 2200 },
    vehicleLength: 14,
    pricing: [
      { distanceRange: { min: 0, max: 50 }, price: 3600 },
      { distanceRange: { min: 51, max: 60 }, price: 3600 },
      { distanceRange: { min: 61, max: 100 }, price: 7200 },
      { distanceRange: { min: 101, max: 150 }, price: 9200 },
      { distanceRange: { min: 151, max: 200 }, price: 12600 },
      { distanceRange: { min: 201, max: 250 }, price: 12200 },
      { distanceRange: { min: 251, max: 300 }, price: 18000 },
      { distanceRange: { min: 301, max: 350 }, price: 17800 },
      { distanceRange: { min: 351, max: 400 }, price: 17800 },
      { distanceRange: { min: 401, max: 450 }, price: 21000 },
      { distanceRange: { min: 451, max: 500 }, price: 22600 },
      { distanceRange: { min: 501, max: 600 }, price: 20500 },
      { distanceRange: { min: 601, max: 700 }, price: 28200 },
      { distanceRange: { min: 701, max: 800 }, price: 29300 },
      { distanceRange: { min: 801, max: 900 }, price: 28800 },
      { distanceRange: { min: 901, max: 1000 }, price: 36900 },
      { distanceRange: { min: 1001, max: 1200 }, price: 37700 },
      { distanceRange: { min: 1201, max: 1500 }, price: 50800 },
      { distanceRange: { min: 1501, max: 1800 }, price: 45900 },
      { distanceRange: { min: 1801, max: 2000 }, price: 45900 },
      { distanceRange: { min: 2001, max: 2200 }, price: 67500 }
    ]
  },
  {
    vehicleType: 'Eicher 14 ft',
    weightRange: { min: 2501, max: 3000 },
    distanceRange: { min: 0, max: 2500 },
    vehicleLength: 14,
    pricing: [
      { distanceRange: { min: 0, max: 50 }, price: 3600 },
      { distanceRange: { min: 51, max: 60 }, price: 3600 },
      { distanceRange: { min: 61, max: 100 }, price: 7200 },
      { distanceRange: { min: 101, max: 150 }, price: 9200 },
      { distanceRange: { min: 151, max: 200 }, price: 12600 },
      { distanceRange: { min: 201, max: 250 }, price: 12200 },
      { distanceRange: { min: 251, max: 300 }, price: 18000 },
      { distanceRange: { min: 301, max: 350 }, price: 17800 },
      { distanceRange: { min: 351, max: 400 }, price: 17800 },
      { distanceRange: { min: 401, max: 450 }, price: 21000 },
      { distanceRange: { min: 451, max: 500 }, price: 22600 },
      { distanceRange: { min: 501, max: 600 }, price: 20500 },
      { distanceRange: { min: 601, max: 700 }, price: 28200 },
      { distanceRange: { min: 701, max: 800 }, price: 29300 },
      { distanceRange: { min: 801, max: 900 }, price: 28800 },
      { distanceRange: { min: 901, max: 1000 }, price: 36900 },
      { distanceRange: { min: 1001, max: 1200 }, price: 37700 },
      { distanceRange: { min: 1201, max: 1500 }, price: 50800 },
      { distanceRange: { min: 1501, max: 1800 }, price: 65100 },
      { distanceRange: { min: 1801, max: 2000 }, price: 45900 },
      { distanceRange: { min: 2001, max: 2200 }, price: 67500 }
    ]
  },
  {
    vehicleType: 'Eicher 14 ft',
    weightRange: { min: 3001, max: 3500 },
    distanceRange: { min: 0, max: 2700 },
    vehicleLength: 14,
    pricing: [
      { distanceRange: { min: 0, max: 50 }, price: 3600 },
      { distanceRange: { min: 51, max: 60 }, price: 3600 },
      { distanceRange: { min: 61, max: 100 }, price: 7200 },
      { distanceRange: { min: 101, max: 150 }, price: 9200 },
      { distanceRange: { min: 151, max: 200 }, price: 12600 },
      { distanceRange: { min: 201, max: 250 }, price: 12200 },
      { distanceRange: { min: 251, max: 300 }, price: 18000 },
      { distanceRange: { min: 301, max: 350 }, price: 17800 },
      { distanceRange: { min: 351, max: 400 }, price: 17800 },
      { distanceRange: { min: 401, max: 450 }, price: 21000 },
      { distanceRange: { min: 451, max: 500 }, price: 22600 },
      { distanceRange: { min: 501, max: 600 }, price: 20500 },
      { distanceRange: { min: 601, max: 700 }, price: 28200 },
      { distanceRange: { min: 701, max: 800 }, price: 29300 },
      { distanceRange: { min: 801, max: 900 }, price: 28800 },
      { distanceRange: { min: 901, max: 1000 }, price: 36900 },
      { distanceRange: { min: 1001, max: 1200 }, price: 37700 },
      { distanceRange: { min: 1201, max: 1500 }, price: 50800 },
      { distanceRange: { min: 1501, max: 1800 }, price: 65100 },
      { distanceRange: { min: 1801, max: 2000 }, price: 45900 },
      { distanceRange: { min: 2001, max: 2200 }, price: 67500 },
      { distanceRange: { min: 2201, max: 2500 }, price: 74100 },
      { distanceRange: { min: 2501, max: 2600 }, price: 77300 },
      { distanceRange: { min: 2601, max: 2700 }, price: 79100 }
    ]
  },
  {
    vehicleType: 'Eicher 14 ft',
    weightRange: { min: 3501, max: 4000 },
    distanceRange: { min: 0, max: 2200 },
    vehicleLength: 14,
    pricing: [
      { distanceRange: { min: 0, max: 50 }, price: 3600 },
      { distanceRange: { min: 51, max: 60 }, price: 3600 },
      { distanceRange: { min: 61, max: 100 }, price: 7200 },
      { distanceRange: { min: 101, max: 150 }, price: 9200 },
      { distanceRange: { min: 151, max: 200 }, price: 12600 },
      { distanceRange: { min: 201, max: 250 }, price: 12200 },
      { distanceRange: { min: 251, max: 300 }, price: 18000 },
      { distanceRange: { min: 301, max: 350 }, price: 17800 },
      { distanceRange: { min: 351, max: 400 }, price: 17800 },
      { distanceRange: { min: 401, max: 450 }, price: 21000 },
      { distanceRange: { min: 451, max: 500 }, price: 22600 },
      { distanceRange: { min: 501, max: 600 }, price: 20500 },
      { distanceRange: { min: 601, max: 700 }, price: 28200 },
      { distanceRange: { min: 701, max: 800 }, price: 29300 },
      { distanceRange: { min: 801, max: 900 }, price: 28800 },
      { distanceRange: { min: 901, max: 1000 }, price: 36900 },
      { distanceRange: { min: 1001, max: 1200 }, price: 37700 },
      { distanceRange: { min: 1201, max: 1500 }, price: 50800 },
      { distanceRange: { min: 1501, max: 1800 }, price: 65100 },
      { distanceRange: { min: 1801, max: 2000 }, price: 45900 },
      { distanceRange: { min: 2001, max: 2200 }, price: 67500 }
    ]
  },
  {
    vehicleType: 'Eicher 19 ft',
    weightRange: { min: 4001, max: 7000 },
    distanceRange: { min: 0, max: 2700 },
    vehicleLength: 19,
    pricing: [
      { distanceRange: { min: 0, max: 50 }, price: 6000 },
      { distanceRange: { min: 51, max: 60 }, price: 6000 },
      { distanceRange: { min: 61, max: 100 }, price: 10000 },
      { distanceRange: { min: 101, max: 150 }, price: 11200 },
      { distanceRange: { min: 151, max: 200 }, price: 13500 },
      { distanceRange: { min: 201, max: 250 }, price: 14600 },
      { distanceRange: { min: 251, max: 300 }, price: 17200 },
      { distanceRange: { min: 301, max: 350 }, price: 22400 },
      { distanceRange: { min: 351, max: 400 }, price: 22400 },
      { distanceRange: { min: 401, max: 450 }, price: 21500 },
      { distanceRange: { min: 451, max: 500 }, price: 22500 },
      { distanceRange: { min: 501, max: 600 }, price: 33800 },
      { distanceRange: { min: 601, max: 700 }, price: 38100 },
      { distanceRange: { min: 701, max: 800 }, price: 35600 },
      { distanceRange: { min: 801, max: 900 }, price: 43400 },
      { distanceRange: { min: 901, max: 1000 }, price: 35900 },
      { distanceRange: { min: 1001, max: 1200 }, price: 44500 },
      { distanceRange: { min: 1201, max: 1500 }, price: 56400 },
      { distanceRange: { min: 1501, max: 1800 }, price: 47800 },
      { distanceRange: { min: 1801, max: 2000 }, price: 62100 },
      { distanceRange: { min: 2001, max: 2200 }, price: 78300 },
      { distanceRange: { min: 2201, max: 2500 }, price: 86200 },
      { distanceRange: { min: 2501, max: 2600 }, price: 93200 },
      { distanceRange: { min: 2601, max: 2700 }, price: 98200 }
    ]
  },
  {
    vehicleType: 'Eicher 20 ft',
    weightRange: { min: 7001, max: 10000 },
    distanceRange: { min: 0, max: 2700 },
    vehicleLength: 20,
    pricing: [
      { distanceRange: { min: 0, max: 50 }, price: 10800 },
      { distanceRange: { min: 51, max: 60 }, price: 10800 },
      { distanceRange: { min: 61, max: 100 }, price: 13300 },
      { distanceRange: { min: 101, max: 150 }, price: 13700 },
      { distanceRange: { min: 151, max: 200 }, price: 18800 },
      { distanceRange: { min: 201, max: 250 }, price: 18100 },
      { distanceRange: { min: 251, max: 300 }, price: 21500 },
      { distanceRange: { min: 301, max: 350 }, price: 27500 },
      { distanceRange: { min: 351, max: 400 }, price: 27500 },
      { distanceRange: { min: 401, max: 450 }, price: 27800 },
      { distanceRange: { min: 451, max: 500 }, price: 32000 },
      { distanceRange: { min: 501, max: 600 }, price: 29100 },
      { distanceRange: { min: 601, max: 700 }, price: 35600 },
      { distanceRange: { min: 701, max: 800 }, price: 42900 },
      { distanceRange: { min: 801, max: 900 }, price: 47000 },
      { distanceRange: { min: 901, max: 1000 }, price: 39100 },
      { distanceRange: { min: 1001, max: 1200 }, price: 62600 },
      { distanceRange: { min: 1201, max: 1500 }, price: 65800 },
      { distanceRange: { min: 1501, max: 1800 }, price: 82900 },
      { distanceRange: { min: 1801, max: 2000 }, price: 72400 },
      { distanceRange: { min: 2001, max: 2200 }, price: 92600 },
      { distanceRange: { min: 2201, max: 2500 }, price: 101200 },
      { distanceRange: { min: 2501, max: 2600 }, price: 106800 },
      { distanceRange: { min: 2601, max: 2700 }, price: 107900 }
    ]
  },
  {
    vehicleType: 'Container 32 ft MXL',
    weightRange: { min: 10001, max: 18000 },
    distanceRange: { min: 0, max: 2700 },
    vehicleLength: 32,
    pricing: [
      { distanceRange: { min: 0, max: 50 }, price: 15400 },
      { distanceRange: { min: 51, max: 60 }, price: 15400 },
      { distanceRange: { min: 61, max: 100 }, price: 25500 },
      { distanceRange: { min: 101, max: 150 }, price: 29100 },
      { distanceRange: { min: 151, max: 200 }, price: 26300 },
      { distanceRange: { min: 201, max: 250 }, price: 32200 },
      { distanceRange: { min: 251, max: 300 }, price: 35800 },
      { distanceRange: { min: 301, max: 350 }, price: 38400 },
      { distanceRange: { min: 351, max: 400 }, price: 40700 },
      { distanceRange: { min: 401, max: 450 }, price: 43500 },
      { distanceRange: { min: 451, max: 500 }, price: 49300 },
      { distanceRange: { min: 501, max: 600 }, price: 57000 },
      { distanceRange: { min: 601, max: 700 }, price: 64400 },
      { distanceRange: { min: 701, max: 800 }, price: 72100 },
      { distanceRange: { min: 801, max: 900 }, price: 86900 },
      { distanceRange: { min: 901, max: 1000 }, price: 68300 },
      { distanceRange: { min: 1001, max: 1200 }, price: 87900 },
      { distanceRange: { min: 1201, max: 1500 }, price: 100300 },
      { distanceRange: { min: 1501, max: 1800 }, price: 113300 },
      { distanceRange: { min: 1801, max: 2000 }, price: 113300 },
      { distanceRange: { min: 2001, max: 2200 }, price: 122600 },
      { distanceRange: { min: 2201, max: 2500 }, price: 134800 },
      { distanceRange: { min: 2501, max: 2600 }, price: 142800 },
             { distanceRange: { min: 2601, max: 2700 }, price: 148400 }
     ]
   }
 ];

// Upload function
const uploadWheelseyePricing = async () => {
  try {
    console.log('Starting Wheelseye pricing upload...');
    
    // Clear existing data
    await WheelseyePricing.deleteMany({});
    console.log('Cleared existing Wheelseye pricing data');
    
    // Insert new data
    const result = await WheelseyePricing.insertMany(wheelseyePricingData);
    console.log(`Successfully uploaded ${result.length} Wheelseye pricing records`);
    
    // Display summary
    console.log('\n=== Wheelseye Pricing Summary ===');
    result.forEach(record => {
      console.log(`${record.vehicleType} (${record.weightRange.min}-${record.weightRange.max}kg, ${record.distanceRange.min}-${record.distanceRange.max}km): ${record.pricing.length} pricing tiers`);
    });
    
    console.log('\nWheelseye pricing upload completed successfully!');
  } catch (error) {
    console.error('Error uploading Wheelseye pricing:', error);
  } finally {
    mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the upload
console.log('Running upload function...');
connectDB().then(() => {
  uploadWheelseyePricing();
}).catch(error => {
  console.error('Failed to connect to database:', error);
});

export { uploadWheelseyePricing };
