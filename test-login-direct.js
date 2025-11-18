// Direct test of login controller logic
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import customerModel from './model/customerModel.js';

dotenv.config({ path: './config.env' });

async function testLoginPerformance() {
  console.log('🔍 Testing login performance...\n');
  
  try {
    // Connect to database
    console.log('1. Connecting to database...');
    const connectStart = Date.now();
    await mongoose.connect(process.env.MONGO_DB_URL);
    console.log(`   ✅ Connected in ${Date.now() - connectStart}ms\n`);
    
    // Test 2: Find user query
    console.log('2. Testing user lookup...');
    const findStart = Date.now();
    const customer = await customerModel.findOne({ email: 'test@example.com' });
    const findTime = Date.now() - findStart;
    console.log(`   ✅ User lookup: ${findTime}ms`);
    console.log(`   📊 User found: ${customer ? 'Yes' : 'No'}\n`);
    
    if (!customer) {
      console.log('   ℹ️  No test user found. Creating one...');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('testpassword', salt);
      const newCustomer = new customerModel({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: 1234567890,
        whatsappNumber: 1234567890,
        password: hashedPassword,
        companyName: 'Test Company',
        gstNumber: 'TEST123456',
        businessType: 'Test',
        monthlyOrder: 10,
        address: 'Test Address',
        state: 'Test State',
        pincode: 123456,
        tokenAvailable: 10,
        isSubscribed: false,
        isTransporter: false,
        isAdmin: false
      });
      await newCustomer.save();
      console.log('   ✅ Test user created\n');
    }
    
    // Test 3: Password comparison
    if (customer) {
      console.log('3. Testing password comparison...');
      const bcryptStart = Date.now();
      const isMatch = await bcrypt.compare('testpassword', customer.password);
      const bcryptTime = Date.now() - bcryptStart;
      console.log(`   ✅ Password comparison: ${bcryptTime}ms`);
      console.log(`   📊 Password match: ${isMatch ? 'Yes' : 'No'}\n`);
      
      if (bcryptTime > 1000) {
        console.log('   ⚠️  WARNING: bcrypt is very slow! This might be the issue.');
      }
    }
    
    console.log('✅ Login performance test complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Connection closed');
  }
}

testLoginPerformance();
