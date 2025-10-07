import express from 'express';
import { changePasswordController, forgotPasswordController, initiateSignup, loginController, verifyOtpsAndSignup} from '../controllers/authController.js';

const router = express.Router();

// @route   POST api/auth/signup
// @desc    Register a new customer
// @access  Public
router.post('/signup/initiate', initiateSignup);
router.post('/signup/verify', verifyOtpsAndSignup);
router.post('/login', loginController);
router.post('/forgotpassword', forgotPasswordController);
router.post('/changepassword', changePasswordController);

// You can add login route here later
// router.post('/login', loginCustomer);

export default router;