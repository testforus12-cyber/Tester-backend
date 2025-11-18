import express from 'express';
import { changePasswordController, forgotPasswordController, initiateSignup, loginController, verifyOtpsAndSignup} from '../controllers/authController.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// @route   POST api/auth/signup
// @desc    Register a new customer
// @access  Public
router.post('/signup/initiate', authLimiter, initiateSignup);
router.post('/signup/verify', authLimiter, verifyOtpsAndSignup);
router.post('/login', authLimiter, loginController);
router.post('/forgotpassword', authLimiter, forgotPasswordController);
router.post('/changepassword', authLimiter, changePasswordController);

// You can add login route here later
// router.post('/login', loginCustomer);

export default router;