import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';

/**
 * Extract slug from various sources in request
 */
const extractSlug = (req) => {
    const sources = [
        req.body?.slug,
        req.query?.slug,
        req.params?.slug,
        req.headers['x-user-slug'],
        req.headers['x-slug'],
    ];

    for (const raw of sources) {
        if (typeof raw === 'string' && raw.trim().length > 0) {
            return raw.trim();
        }
    }
    return null;
};

/**
 * Treasurer Auth Middleware
 * Allows access if user is:
 * 1. An admin (role === 2), OR
 * 2. A treasurer (treasurer === true)
 * 
 * This middleware is specifically designed for invoice-related routes
 * where both admins and treasurers should have access.
 */
const treasurerAuth = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ 
                success: false, 
                message: "Not Authorized. Login again." 
            });
        }

        const token = authHeader.split(" ")[1];

        const slug = extractSlug(req);
        if (!slug) {
            return res.status(400).json({ 
                success: false, 
                message: "Missing slug." 
            });
        }

        // Find user by slug
        const user = await userModel.findOne({ slug });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found." 
            });
        }

        // Decode token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Verify email matches
        if (decoded.email !== user.email) {
            return res.status(403).json({ 
                success: false, 
                message: "Not authorized. Token mismatch." 
            });
        }

        // Check if user is admin (role === 2) OR treasurer
        const isAdmin = user.role === 2;
        const isTreasurer = user.treasurer === true;

        if (!isAdmin && !isTreasurer) {
            return res.status(403).json({ 
                success: false, 
                message: "Not authorized. Only admins or treasurers can access this resource." 
            });
        }

        // Attach user and access info to request
        req.user = user;
        req.isAdmin = isAdmin;
        req.isTreasurer = isTreasurer;

        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            message: "Invalid or expired token." 
        });
    }
};

export default treasurerAuth;
