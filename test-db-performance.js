// Test database performance
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: './config.env' });

async function testDatabasePerformance() {
  console.log('🔍 Testing database connection performance...\n');
  
  try {
    // Test 1: Connection time
    console.log('1. Testing connection time...');
    const connectStart = Date.now();
    await mongoose.connect(process.env.MONGO_DB_URL, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 10000,
    });
    const connectTime = Date.now() - connectStart;
    console.log(`   ✅ Connected in ${connectTime}ms`);
    
    if (connectTime > 5000) {
      console.log('   ⚠️  WARNING: Connection took more than 5 seconds!');
    }
    
    // Test 2: Simple query
    console.log('\n2. Testing simple query...');
    const queryStart = Date.now();
    const collections = await mongoose.connection.db.listCollections().toArray();
    const queryTime = Date.now() - queryStart;
    console.log(`   ✅ Query completed in ${queryTime}ms`);
    console.log(`   📊 Found ${collections.length} collections`);
    
    // Test 3: Ping
    console.log('\n3. Testing ping...');
    const pingStart = Date.now();
    await mongoose.connection.db.admin().ping();
    const pingTime = Date.now() - pingStart;
    console.log(`   ✅ Ping: ${pingTime}ms`);
    
    if (pingTime > 1000) {
      console.log('   ⚠️  WARNING: High latency to database!');
    }
    
    console.log('\n✅ Database performance test complete!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Connection closed');
  }
}

testDatabasePerformance();
