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

// Test integration with calculator-like scenarios
const testIntegration = async () => {
  try {
    console.log('Testing freight rate integration with calculator scenarios...\n');
    
    // Test scenarios that match typical calculator usage
    const testScenarios = [
      { weight: 1000, distance: 500, description: "Small shipment" },
      { weight: 5000, distance: 1000, description: "Medium shipment" },
      { weight: 10000, distance: 2000, description: "Large shipment" },
      { weight: 20000, distance: 3000, description: "Heavy shipment" }
    ];
    
    for (const scenario of testScenarios) {
      console.log(`\n📦 Testing: ${scenario.description}`);
      console.log(`   Weight: ${scenario.weight}kg, Distance: ${scenario.distance}km`);
      
      const result = await FreightRateService.getVehicleAndPrice(scenario.weight, scenario.distance);
      
      if (result.error) {
        console.log(`   ❌ Error: ${result.error}`);
      } else {
        console.log(`   ✅ Vehicle: ${result.vehicle}`);
        console.log(`   ✅ Vehicle Length: ${result.vehicleLength} ft`);
        console.log(`   ✅ Matched Weight: ${result.matchedWeight}kg`);
        console.log(`   ✅ Matched Distance: ${result.matchedDistance}km`);
        console.log(`   ✅ Price: ₹${result.price.toLocaleString()}`);
        
        // Calculate FTL and Wheelseye prices (like in calculator)
        const ftlPrice = result.price;
        const wheelseyePrice = Math.round((ftlPrice * 0.8) / 10) * 10;
        
        console.log(`   🚛 FTL Price: ₹${ftlPrice.toLocaleString()}`);
        console.log(`   🔄 Wheelseye FTL Price: ₹${wheelseyePrice.toLocaleString()}`);
      }
    }
    
    // Test available options
    console.log('\n📊 Testing available options...');
    const options = await FreightRateService.getAvailableOptions();
    
    if (options.error) {
      console.log(`❌ Error: ${options.error}`);
    } else {
      console.log(`✅ Available vehicles: ${options.vehicles.length}`);
      console.log(`✅ Available weights: ${options.weights.length}`);
      console.log(`✅ Available distances: ${options.distances.length}`);
      console.log(`   Sample vehicles: ${options.vehicles.slice(0, 3).join(', ')}`);
      console.log(`   Weight range: ${Math.min(...options.weights)} - ${Math.max(...options.weights)}kg`);
      console.log(`   Distance range: ${Math.min(...options.distances)} - ${Math.max(...options.distances)}km`);
    }
    
  } catch (error) {
    console.error('Integration test failed:', error);
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await testIntegration();
    console.log('\n✅ Integration test completed successfully');
  } catch (error) {
    console.error('Integration test execution failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
    process.exit(0);
  }
};

// Run the test
main();


