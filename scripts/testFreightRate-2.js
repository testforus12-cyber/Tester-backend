import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FreightRateService } from '../utils/freightRateService.js';

// Load environment variables
dotenv.config();

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/freightcompare');
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Test freight rate calculation
const testFreightRateCalculation = async () => {
  try {
    console.log('Testing freight rate calculation...\n');
    
    // Test cases
    const testCases = [
      { weight: 1000, distance: 500 },
      { weight: 5000, distance: 1000 },
      { weight: 10000, distance: 2000 },
      { weight: 20000, distance: 3000 }
    ];
    
    for (const testCase of testCases) {
      console.log(`Testing: Weight = ${testCase.weight}kg, Distance = ${testCase.distance}km`);
      
      const result = await FreightRateService.getVehicleAndPrice(testCase.weight, testCase.distance);
      
      if (result.error) {
        console.log(`❌ Error: ${result.error}\n`);
      } else {
        console.log(`✅ Vehicle: ${result.vehicle}`);
        console.log(`   Vehicle Length: ${result.vehicleLength} ft`);
        console.log(`   Matched Weight: ${result.matchedWeight}kg`);
        console.log(`   Matched Distance: ${result.matchedDistance}km`);
        console.log(`   Price: ₹${result.price}\n`);
      }
    }
    
    // Test available options
    console.log('Testing available options...');
    const options = await FreightRateService.getAvailableOptions();
    
    if (options.error) {
      console.log(`❌ Error: ${options.error}\n`);
    } else {
      console.log(`✅ Available vehicles: ${options.vehicles.length}`);
      console.log(`   Available weights: ${options.weights.length}`);
      console.log(`   Available distances: ${options.distances.length}`);
      console.log(`   Sample vehicles: ${options.vehicles.slice(0, 3).join(', ')}`);
      console.log(`   Weight range: ${Math.min(...options.weights)} - ${Math.max(...options.weights)}kg`);
      console.log(`   Distance range: ${Math.min(...options.distances)} - ${Math.max(...options.distances)}km\n`);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await testFreightRateCalculation();
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
    process.exit(0);
  }
};

// Run the test
main();


