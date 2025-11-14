import bcrypt from "bcrypt";
import dotenv from "dotenv";
import customerModel from "../model/customerModel.js";
import jwt from "jsonwebtoken";
import generatePassword from "generate-password";
import nodemailer from "nodemailer";
import twilio from "twilio";
import redisClient from "../utils/redisClient.js";

dotenv.config({ path: './config.env' });

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

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const generateOTP = () => {
  const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  let otp = "";
  for (let i = 0; i < 6; i++) {
    const ran = Math.floor(Math.random() * 10);
    otp += arr[ran];
  }
  return otp;
};

export const initiateSignup = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      whatsapp,
      password,
      companyName,
      gstNumber,
      businessType,
      monthlyOrder,
      address,
      state,
      pincode,
      typeOfLoad,
      products,
      handlingCare,
      customerNetwork,
      averageLoadInDispatch,
      maxLoadInDispatch,
      maxLength,
      maxWidth,
      maxHeight,
      typeOfCustomers,
    } = req.body;

    console.log(req.body);

    const required = {
      firstName,
      lastName,
      email,
      phone,
      password,
      whatsapp,
      companyName,
      gstNumber,
      businessType,
      monthlyOrder,
      address,
      state,
      pincode,
    };

    const missing = Object.entries(required)
      .filter(([_, value]) => value === undefined || value === null || value === "")
      .map(([key]) => key);

    if (missing.length) {
      return res.status(400).json({
        message: `Missing required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`,
      });
    }

    const existingCustomer = await customerModel.findOne({
      $or: [{ email }, { phone }, { gstNumber }, { address }],
    });

    if (existingCustomer) {
      return res.status(409).json({ message: "Customer already exists." });
    }

    const emailOtp = generateOTP();
    const phoneOtp = generateOTP();
    console.log("Email OTP:", emailOtp, "| Phone OTP:", phoneOtp);

    const redisPayload = {
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: Number(phone),
        whatsappNumber: Number(whatsapp),
        password,
        companyName: companyName.trim(),
        gstNumber: gstNumber.trim(),
        businessType: businessType?.trim() || "",
        monthlyOrder: Number(monthlyOrder),
        address: address.trim(),
        state: state.trim(),
        pincode: Number(pincode),
        typeOfLoad: typeOfLoad?.trim() || "",
        products: products?.trim() || "",
        handlingCare: handlingCare?.trim() || "",
        customerNetwork: customerNetwork?.trim() || "",
        averageLoadInDispatch: Number(averageLoadInDispatch) || 0,
        maxLoadInDispatch: Number(maxLoadInDispatch) || 0,
        maxLength: Number(maxLength) || 0,
        maxWidth: Number(maxWidth) || 0,
        maxHeight: Number(maxHeight) || 0,
        typeOfCustomers: typeOfCustomers?.trim() || "",
      },
      otps: { emailOtp, phoneOtp },
    };

    await redisClient.setEx(`pendingSignup:${email}`, 600, JSON.stringify(redisPayload));

    await transporter.sendMail({
      from: "Forus Logistics <tech@foruselectric.com>",
      to: email,
      subject: "Email Verification - Forus Logistics",
      html: `<p>Your email verification OTP is <strong>${emailOtp}</strong>. It will expire in 10 minutes.</p>`,
    });

    // TODO: Send phoneOtp via SMS provider

    return res.status(200).json({
      message: "OTP sent to email and phone. Please verify to complete registration.",
    });
  } catch (error) {
    console.error("Initiate Signup Error:", error);
    return res.status(500).json({ message: "Server error." });
  }
};



export const verifyOtpsAndSignup = async (req, res) => {
  const { email, emailOtp, phoneOtp } = req.body;

  try {
    const redisData = await redisClient.get(`pendingSignup:${email}`);
    if (!redisData) {
      return res.status(400).json({ message: "No pending verification found or expired." });
    }

    const { data, otps } = JSON.parse(redisData);

    if (otps.emailOtp !== emailOtp) {
      return res.status(400).json({ message: "Invalid OTP(s)." });
    }

    const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(data.password, salt);

    const newCustomer = new customerModel({
      ...data,
      password: hashedPassword,
      isSubscribed: false,
      isTransporter: false,
      isAdmin: false,
      tokenAvailable: 10,
    });

    await newCustomer.save();
    await redisClient.del(`pendingSignup:${email}`);

    const customerData = { ...newCustomer._doc };
    delete customerData.password;

    return res.status(201).json({
      message: "Customer registered successfully after verification.",
      customer: customerData,
    });
  } catch (error) {
    console.error("Verification Signup Error:", error);
    return res.status(500).json({ message: "Server error during verification." });
  }
};


export const loginController = async (req, res) => {
  const { email, password } = req.body;

  // 1. Basic validation
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide email and password." });
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your_jwt_secret_key_change_this_to_a_secure_random_string_minimum_32_characters') {
    console.error("FATAL ERROR: JWT_SECRET is not properly configured.");
    console.error("Current JWT_SECRET value:", process.env.JWT_SECRET ? "SET (but may be default)" : "NOT SET");
    return res.status(500).json({ 
      message: "Server configuration error: JWT_SECRET not properly set.",
      error: process.env.NODE_ENV === "development" ? "JWT_SECRET missing or using default value" : undefined
    });
  }

  try {
    // 2. Find customer by email
    const customer = await customerModel.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!customer) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // 3. Compare password
    const isMatch = await bcrypt.compare(password, customer.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // 4. Create JWT payload (include essential non-sensitive info)
    const payload = {
      customer: {
        _id: customer._id,
        email: customer.email,
        phone: customer.phone,
        firstName: customer.firstName,
        lastName: customer.lastName,
        companyName: customer.companyName,
        gstNumber: customer.gstNumber,
        businessType: customer.businessType,
        monthlyOrder: customer.monthlyOrder,
        address: customer.address,
        state: customer.state,
        pincode: customer.pincode,
        tokenAvailable: customer.tokenAvailable,
        isSubscribed: customer.isSubscribed
      },
    };

    // 5. Sign the token
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
      (err, token) => {
        if (err) {
          console.error("JWT Sign Error:", err);
          return res.status(500).json({ 
            message: "Server error during token generation.",
            error: process.env.NODE_ENV === "development" ? err.message : undefined
          });
        }

        try {
          const customerData = customer.toObject ? customer.toObject() : { ...customer._doc };
          delete customerData.password; // Remove password from response

          return res.status(200).json({
            message: "Login successful!",
            token,
            customer: customerData,
          });
        } catch (dataError) {
          console.error("Error processing customer data:", dataError);
          return res.status(500).json({ 
            message: "Server error during login.",
            error: process.env.NODE_ENV === "development" ? dataError.message : undefined
          });
        }
      }
    );
  } catch (error) {
    console.error("Login Error:", error);
    console.error("Error Stack:", error.stack);
    return res.status(500).json({ 
      message: "Server error during login.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

export const forgotPasswordController = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ message: "Please provide your email address." });
    }

    const customer = await customerModel.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!customer) {
      console.log(`Forgot password attempt for non-existent email: ${email}`);
      return res.status(200).json({
        success: false,
        message:
          "If an account with that email exists, a new password has been sent.",
      });
    }

    const newPassword = generatePassword.generate({
      length: 12,
      numbers: true,
      symbols: true,
      uppercase: true,
      lowercase: true,
      strict: true,
    });

    console.log(`Generated new password for ${email}: ${newPassword}`);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    customer.password = hashedPassword;
    await customer.save();

    const fullName = `${customer.firstName} ${customer.lastName}`;

    const emailHtml = `...${newPassword}...${fullName}...`; // keep your HTML template with updated variables

    await transporter.sendMail({
      from: "Forus Team <tech@foruselectric.com>",
      to: customer.email,
      subject: "Your New Password - Forus Logistics",
      html: emailHtml,
    });

    return res.status(200).send({
      success: true,
      message: "Password Reset Successful",
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res
      .status(500)
      .json({ message: "Server error during password reset process." });
  }
};
export const changePasswordController = async (req, res) => {
  try {
    const { email, password, newpassword } = req.body;

    if (!email || !password || !newpassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide email, current password, and new password.",
      });
    }

    const user = await customerModel.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Wrong Password Entered",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newpassword, salt);
    user.password = hashedPassword;
    await user.save();

    const fullName = `${user.firstName} ${user.lastName}`;

    const emailHtml = `...${fullName}...`; // plug into your existing HTML

    await transporter.sendMail({
      from: "Forus Team <tech@foruselectric.com>",
      to: user.email,
      subject: "Password Changed - Forus Logistics",
      html: emailHtml,
    });

    return res.status(200).send({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Password Change Error:", error);
    res
      .status(500)
      .json({ message: "Server error during password change process." });
  }
};
