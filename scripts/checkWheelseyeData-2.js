import mongoose from 'mongoose';
import WheelseyePricing from '../model/wheelseyePricingModel.js';
import dotenv from 'dotenv';

dotenv.config();

const checkWheelseyeData = async () => {
  try {
    console.log('Checking Wheelseye pricing data...');
    const url = process.env.MONGO_DB_URL || 'mongodb://localhost:27017/freight_compare';
    
    await mongoose.connect(url);
    console.log('✅ MongoDB connected successfully!');
    
    // Count documents
    const count = await WheelseyePricing.countDocuments();
    console.log(`Total Wheelseye pricing records: ${count}`);
    
    if (count > 0) {
      // Get sample data
      const sample = await WheelseyePricing.find().limit(3);
      console.log('\nSample records:');
      sample.forEach((record, index) => {
        console.log(`${index + 1}. ${record.vehicleType} (${record.weightRange.min}-${record.weightRange.max}kg)`);
        console.log(`   Pricing tiers: ${record.pricing.length}`);
        console.log(`   Vehicle length: ${record.vehicleLength}ft`);
      });
    } else {
      console.log('No Wheelseye pricing data found in database.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('Connection closed');
  }
};

checkWheelseyeData();
