import jwt from 'jsonwebtoken';
import customerModel from '../model/customerModel.js';

export const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            if (!token) {
                return res.status(401).json({ success: false, message: 'Not authorized, no token found in Bearer string' });
            }

            // Get JWT_SECRET at runtime, not at module load time
            const JWT_SECRET = process.env.JWT_SECRET;
            
            if (!JWT_SECRET || JWT_SECRET === 'your_jwt_secret_key_change_this_to_a_secure_random_string_minimum_32_characters') {
                console.error("FATAL ERROR: JWT_SECRET is not properly configured.");
                return res.status(500).json({ success: false, message: 'Server configuration error: JWT_SECRET not set' });
            }

            const decoded = jwt.verify(token, JWT_SECRET);
            
            if (!decoded.customer || !decoded.customer._id) {
                return res.status(401).json({ success: false, message: 'Not authorized, invalid token structure' });
            }
            
            req.customer = await customerModel.findById(decoded.customer._id).select('-password');

            if (!req.customer) {
                return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
            }

            next();
        } catch (error) {
            console.error('Token verification failed:', error.message);
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ success: false, message: 'Not authorized, token is invalid' });
            }
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ success: false, message: 'Not authorized, token has expired' });
            }
            return res.status(401).json({ success: false, message: 'Not authorized, token processing failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
    }
};