import priceModel from "../model/priceModel.js";
import transporterModel from "../model/transporterModel.js";
import xlsx from "xlsx";
import path from 'path';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
import redisClient from "../utils/redisClient.js";
import dotenv from 'dotenv'
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

dotenv.config();

const BCRYPT_SALT_ROUNDS = 10;

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.NODEMAILER_USER,
    pass: process.env.NODEMAILER_PASSWORD,
  },
});


export const addTransporter = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const {
      companyName,
      phone,
      email,
      password,
      gstNo,
      address,
      state,
      pincode,
      officeStart,
      officeEnd,
      deliveryMode,
      deleiveryTat,
      trackingLink,
      websiteLink,
      experience,
      maxLoading,
      noOfTrucks,
      annualTurnover,
      customerNetwork,
      zones // should be JSON.stringify-ed array
    } = req.body;

    console.log("Received body:", req.body);
    console.log("Received file:", req.file); // from multer

    if (!companyName || !phone || !email || !password || !gstNo || !address || !state || !pincode || !officeStart || !officeEnd) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Parse Excel file
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const service = rows.map(row => ({
      pincode: Number(row.pincode || row.Pincode),
      isOda: String(row.isOda || row.ODA || 'false').toLowerCase() === 'true',
      zone: String(row.zone || row.Zone || '')
    }));

    const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);

    const servicableZones = JSON.parse(zones);

    const transporterPayload = {
      companyName,
      phone,
      email,
      password: hashedPassword,
      gstNo,
      address,
      state,
      pincode: Number(pincode),
      officeStart,
      officeEnd,
      deliveryMode,
      deleiveryTat,
      trackingLink,
      websiteLink,
      experience: Number(experience || 0),
      maxLoading: Number(maxLoading || 0),
      noOfTrucks: Number(noOfTrucks || 0),
      annualTurnover: Number(annualTurnover || 0),
      customerNetwork,
      servicableZones,
      service
    };

    const cacheKey = `transporter:${companyName}`;
    await redisClient.setEx(cacheKey, 60 * 60, JSON.stringify(transporterPayload));

    return res.json({ success: true, message: 'Transporter data cached. Awaiting price chart.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const addPrice = async (req, res) => {
  try {
    const { companyName, priceRate, zoneRates } = req.body;

    if (!companyName || !priceRate || !zoneRates) {
      return res.status(400).json({ success: false, message: 'Missing payload' });
    }

    const cacheKey = `transporter:${companyName}`;
    const transporterJson = await redisClient.get(cacheKey);

    if (!transporterJson) {
      return res.status(404).json({ success: false, message: 'No transporter data in cache' });
    }

    const transporterData = JSON.parse(transporterJson);

    // Save transporter
    const transporter = await transporterModel.findOneAndUpdate(
      { companyName },
      transporterData,
      { upsert: true, new: true }
    );

    // Save price
    const priceDoc = new priceModel({
      companyId: transporter._id,
      priceRate,
      zoneRates
    });

    await priceDoc.save();

    await redisClient.del(cacheKey);

    res.json({
      success: true,
      message: 'Transporter and pricing saved',
      priceId: priceDoc._id
    });
  } catch (err) {
    console.error('Error in /api/prices:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const downloadTransporterTemplate = (req, res) => {
   const filePath = path.join(__dirname, 'templates', 'pincodes_template.xlsx');

  // res.download sets the right headers and streams the file
  res.download(filePath, 'pincodes_template.xlsx', err => {
    if (err) {
      console.error('Download error:', err);
      return res.status(500).json({ success: false, message: 'Could not download file.' });
    }
  });
}

export const transporterLogin = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'Email and password are missing' })
    }

    const findData = await transporterModel.findOne({ email: email.toLowerCase() })
    if (!findData) {
      return res
        .status(400)
        .json({ success: false, message: 'Email not found' })
    }

    const match = await bcrypt.compare(password, findData.password)
    if (!match) {
      return res
        .status(400)
        .json({ success: false, message: 'Password is incorrect' })
    }

    const jwtPayload = {
      _id: findData._id,
      email: findData.email,
      phone: findData.phone,
      companyName: findData.companyName,
      isAdmin: findData.isAdmin,
      isTransporter: findData.isTransporter,
    }

    jwt.sign(
      jwtPayload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
      (err, token) => {
        if (err) {
          console.error('JWT sign error', err)
          return res
            .status(500)
            .json({ success: false, message: 'Could not sign token' })
        }

        // Remove password before sending user back
        const transporterData = findData.toObject()
        delete transporterData.password

        return res.status(200).json({
          success: true,
          message: 'Login successful!',
          token,
          transporter: transporterData,
        })
      }
    )
  } catch (error) {
    console.error('Error during transporter login:', error)
    return res
      .status(500)
      .json({ success: false, message: 'Server error' })
  }
}

export const getTransporters = async (req, res) => {
  try {
    const { transporter } = req.query;
    const transporters = await transporterModel.find({companyName: transporter});
    if (!transporters || transporters.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No transporters found",
      });
    }
    return res.status(200).json({
      success: true,
      data: transporters,
      message: "Transporters fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching transporters:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
}
