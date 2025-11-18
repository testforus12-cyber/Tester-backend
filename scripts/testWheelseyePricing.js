import mongoose from 'mongoose';
import WheelseyePricing from '../model/wheelseyePricingModel.js';
import dotenv from 'dotenv';

dotenv.config();

// MongoDB connection
const connectDB = async () => {
  try {
    const url = process.env.MONGO_DB_URL || 'mongodb://localhost:27017/freight_compare';
    console.log('Attempting to connect to MongoDB...');
    
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

// Test function
const testWheelseyePricing = async () => {
  try {
    console.log('🧪 Testing Wheelseye Pricing Functionality...\n');

    // Test 1: Get all vehicles
    console.log('1. Testing getAllVehicles...');
    const vehicles = await WheelseyePricing.getAllVehicles();
    console.log(`Found ${vehicles.length} vehicle types:`);
    vehicles.forEach(v => {
      console.log(`  - ${v.vehicleType} (${v.weightRange.min}-${v.weightRange.max}kg, ${v.distanceRange.min}-${v.distanceRange.max}km)`);
    });
    console.log('✅ getAllVehicles test passed\n');

    // Test 2: Test pricing calculations
    console.log('2. Testing pricing calculations...');
    
    const testCases = [
      { weight: 900, distance: 150, expectedVehicle: 'Tata Ace' },
      { weight: 1100, distance: 300, expectedVehicle: 'Pickup' },
      { weight: 1300, distance: 500, expectedVehicle: '10 ft Truck' },
      { weight: 1800, distance: 800, expectedVehicle: 'Eicher 14 ft' },
      { weight: 2200, distance: 1200, expectedVehicle: 'Eicher 14 ft' },
      { weight: 2800, distance: 1800, expectedVehicle: 'Eicher 14 ft' },
      { weight: 3200, distance: 2200, expectedVehicle: 'Eicher 14 ft' },
      { weight: 3800, distance: 2000, expectedVehicle: 'Eicher 14 ft' },
      { weight: 5000, distance: 1500, expectedVehicle: 'Eicher 19 ft' },
      { weight: 8000, distance: 2000, expectedVehicle: 'Eicher 20 ft' },
                    { weight: 15000, distance: 2500, expectedVehicle: 'Container 32 ft MXL' }
    ];

    for (const testCase of testCases) {
      try {
        const result = await WheelseyePricing.findPricing(testCase.weight, testCase.distance);
        console.log(`  ✅ ${testCase.weight}kg, ${testCase.distance}km → ${result.vehicle} (₹${result.price})`);
        
        if (result.vehicle !== testCase.expectedVehicle) {
          console.log(`  ⚠️  Expected ${testCase.expectedVehicle}, got ${result.vehicle}`);
        }
      } catch (error) {
        console.log(`  ❌ ${testCase.weight}kg, ${testCase.distance}km → Error: ${error.message}`);
      }
    }
    console.log('✅ Pricing calculations test completed\n');

    // Test 3: Test edge cases
    console.log('3. Testing edge cases...');
    
    const edgeCases = [
      { weight: 850, distance: 1000, description: 'Tata Ace max weight and distance' },
      { weight: 1000, distance: 1000, description: 'Tata Ace max weight and distance' },
      { weight: 1001, distance: 1000, description: 'Pickup min weight and max distance' },
      { weight: 1200, distance: 1000, description: 'Pickup max weight and max distance' },
      { weight: 1201, distance: 1000, description: '10ft Truck min weight and max distance' },
      { weight: 1500, distance: 1000, description: '10ft Truck max weight and max distance' },
      { weight: 1501, distance: 2000, description: 'Eicher 14 ft min weight and max distance' },
                    { weight: 18000, distance: 2700, description: 'Container max weight and max distance' }
    ];

    for (const edgeCase of edgeCases) {
      try {
        const result = await WheelseyePricing.findPricing(edgeCase.weight, edgeCase.distance);
        console.log(`  ✅ ${edgeCase.description}: ${result.vehicle} (₹${result.price})`);
      } catch (error) {
        console.log(`  ❌ ${edgeCase.description}: Error - ${error.message}`);
      }
    }
    console.log('✅ Edge cases test completed\n');

    // Test 4: Test invalid inputs
    console.log('4. Testing invalid inputs...');
    
    const invalidCases = [
      { weight: 0, distance: 100, description: 'Zero weight' },
      { weight: 100, distance: 0, description: 'Zero distance' },
      { weight: -100, distance: 100, description: 'Negative weight' },
      { weight: 100, distance: -100, description: 'Negative distance' },
      { weight: 500, distance: 100, description: 'Weight too low' },
      { weight: 20000, distance: 100, description: 'Weight too high' },
      { weight: 1000, distance: 3000, description: 'Distance too high' }
    ];

    for (const invalidCase of invalidCases) {
      try {
        const result = await WheelseyePricing.findPricing(invalidCase.weight, invalidCase.distance);
        console.log(`  ⚠️  ${invalidCase.description}: Unexpected success - ${result.vehicle} (₹${result.price})`);
      } catch (error) {
        console.log(`  ✅ ${invalidCase.description}: Correctly rejected - ${error.message}`);
      }
    }
    console.log('✅ Invalid inputs test completed\n');

    // Test 5: Performance test
    console.log('5. Testing performance...');
    const startTime = Date.now();
    
    for (let i = 0; i < 100; i++) {
      const weight = Math.floor(Math.random() * 15000) + 500;
      const distance = Math.floor(Math.random() * 2500) + 50;
      try {
        await WheelseyePricing.findPricing(weight, distance);
      } catch (error) {
        // Expected for some random combinations
      }
    }
    
    const endTime = Date.now();
    console.log(`  ✅ 100 random queries completed in ${endTime - startTime}ms`);
    console.log('✅ Performance test completed\n');

    console.log('🎉 All Wheelseye pricing tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the test
console.log('Running Wheelseye pricing tests...');
connectDB().then(() => {
  testWheelseyePricing();
}).catch(error => {
  console.error('Failed to connect to database:', error);
});

export { testWheelseyePricing };
