import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: './config.env' });

const testConnection = async () => {
  try {
    console.log('Testing MongoDB connection...');
    const url = process.env.MONGO_DB_URL || 'mongodb://localhost:27017/freight_compare';
    console.log('Connection URL:', url);
    
    await mongoose.connect(url);
    
    console.log('✅ MongoDB connected successfully!');
    console.log('Database:', mongoose.connection.db.databaseName);
    
    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('Connection closed');
  }
};

testConnection();
