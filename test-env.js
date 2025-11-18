// Test environment variable loading
import dotenv from 'dotenv';

console.log('Testing environment variable loading...\n');

// Test 1: Without path
dotenv.config();
console.log('1. dotenv.config() without path:');
console.log('   JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
console.log('   PORT:', process.env.PORT || 'NOT SET');
console.log('   MONGO_DB_URL:', process.env.MONGO_DB_URL ? 'SET' : 'NOT SET');

// Test 2: With relative path
dotenv.config({ path: './config.env' });
console.log('\n2. dotenv.config({ path: "./config.env" }):');
console.log('   JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
console.log('   JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0);
console.log('   PORT:', process.env.PORT || 'NOT SET');

// Test 3: Show first 20 chars of JWT_SECRET
if (process.env.JWT_SECRET) {
    console.log('\n3. JWT_SECRET value (first 20 chars):');
    console.log('   ', process.env.JWT_SECRET.substring(0, 20) + '...');
}

console.log('\n✅ Test complete');
