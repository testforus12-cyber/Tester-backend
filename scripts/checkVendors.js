import mongoose from 'mongoose';
import transporterModel from '../model/transporterModel.js';

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/freightcompare', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const checkVendors = async () => {
  try {
    await connectDB();
    
    console.log('\n=== VENDOR LIST FROM DATABASE ===\n');
    
    // Get all transporters/vendors
    const vendors = await transporterModel.find({}).select('companyName phone email gstNo state pincode deliveryMode deliveryTat maxLoading noOfTrucks isAdmin isTransporter createdAt');
    
    if (vendors.length === 0) {
      console.log('No vendors found in the database.');
      return;
    }
    
    console.log(`Total vendors found: ${vendors.length}\n`);
    
    vendors.forEach((vendor, index) => {
      console.log(`${index + 1}. Company: ${vendor.companyName}`);
      console.log(`   Phone: ${vendor.phone}`);
      console.log(`   Email: ${vendor.email}`);
      console.log(`   GST: ${vendor.gstNo}`);
      console.log(`   State: ${vendor.state}`);
      console.log(`   Pincode: ${vendor.pincode}`);
      console.log(`   Delivery Mode: ${vendor.deliveryMode || 'Not specified'}`);
      console.log(`   Delivery TAT: ${vendor.deliveryTat || 'Not specified'}`);
      console.log(`   Max Loading: ${vendor.maxLoading || 'Not specified'}`);
      console.log(`   No of Trucks: ${vendor.noOfTrucks || 'Not specified'}`);
      console.log(`   Is Admin: ${vendor.isAdmin}`);
      console.log(`   Is Transporter: ${vendor.isTransporter}`);
      console.log(`   Created: ${vendor.createdAt}`);
      console.log('   ' + '-'.repeat(50));
    });
    
    // Summary
    const adminVendors = vendors.filter(v => v.isAdmin);
    const regularVendors = vendors.filter(v => !v.isAdmin);
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total vendors: ${vendors.length}`);
    console.log(`Admin vendors: ${adminVendors.length}`);
    console.log(`Regular vendors: ${regularVendors.length}`);
    
    // List admin vendors
    if (adminVendors.length > 0) {
      console.log('\nAdmin vendors:');
      adminVendors.forEach(v => console.log(`- ${v.companyName}`));
    }
    
    // List regular vendors
    if (regularVendors.length > 0) {
      console.log('\nRegular vendors:');
      regularVendors.forEach(v => console.log(`- ${v.companyName}`));
    }
    
  } catch (error) {
    console.error('Error checking vendors:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDatabase connection closed.');
  }
};

// Run the script
checkVendors();

