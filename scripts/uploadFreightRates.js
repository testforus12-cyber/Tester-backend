import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Import the FreightRate model
import FreightRate from '../model/freightRateModel.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Process CSV and upload to database
const uploadFreightRates = async (csvFilePath) => {
  try {
    console.log('Starting CSV upload process...');
    
    // Clear existing data
    await FreightRate.deleteMany({});
    console.log('Cleared existing freight rate data');
    
    const results = [];
    
    // Read CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`Read ${results.length} rows from CSV`);
    
    // Process each row
    const freightRates = [];
    
    for (const row of results) {
      try {
        // Extract basic information
        const vehicle = row['Vehicle'] || row['vehicle'];
        const vehicleLength = parseFloat(row['Vehicle Length (ft)'] || row['vehicle_length'] || 0);
        const weight = parseFloat(row['Weight (Kg)'] || row['weight'] || 0);
        
        if (!vehicle || !weight) {
          console.warn('Skipping row with missing vehicle or weight:', row);
          continue;
        }
        
        // Extract distance-based pricing
        const distancePricing = new Map();
        
        for (const [key, value] of Object.entries(row)) {
          if (key.includes('km') && value && !isNaN(parseFloat(value))) {
            // Extract distance number from column name (e.g., "100 km" -> 100)
            const distanceMatch = key.match(/(\d+)\s*km/);
            if (distanceMatch) {
              const distance = parseInt(distanceMatch[1]);
              const price = parseFloat(value);
              distancePricing.set(distance.toString(), price);
            }
          }
        }
        
        // Create freight rate document
        const freightRate = new FreightRate({
          vehicle,
          vehicleLength,
          weight,
          distancePricing,
          originalData: row
        });
        
        freightRates.push(freightRate);
        
      } catch (error) {
        console.error('Error processing row:', row, error);
      }
    }
    
    // Insert all freight rates
    if (freightRates.length > 0) {
      await FreightRate.insertMany(freightRates);
      console.log(`Successfully uploaded ${freightRates.length} freight rate records`);
    } else {
      console.log('No valid freight rate records to upload');
    }
    
    // Get available distances
    const distanceResult = await FreightRate.getAvailableDistances();
    if (distanceResult.length > 0) {
      const distances = distanceResult[0].uniqueDistances.sort((a, b) => parseInt(a) - parseInt(b));
      console.log('Available distances:', distances);
    }
    
  } catch (error) {
    console.error('Error uploading freight rates:', error);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    
    // Use the provided CSV file path
    const csvFilePath = "C:\\Users\\Administrator\\Downloads\\freight_full_rate_table.csv";
    
    if (!fs.existsSync(csvFilePath)) {
      console.error(`CSV file not found at: ${csvFilePath}`);
      process.exit(1);
    }
    
    await uploadFreightRates(csvFilePath);
    console.log('Freight rate upload completed successfully');
    
  } catch (error) {
    console.error('Script execution failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
    process.exit(0);
  }
};

// Run the script
main();

