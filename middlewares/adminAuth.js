import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';

const adminAuth = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Not Authorized. Login again." });
        }

        const token = authHeader.split(" ")[1];

        // Get slug from body
        const { slug } = req.body;
        if (!slug) {
            return res.status(400).json({ message: "Missing slug." });
        }

        // Find user by slug
        const user = await userModel.findOne({ slug });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Decode token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Verify email and role
        if (decoded.email !== user.email || decoded.role !== 2) {
            return res.status(403).json({ message: "Not authorized as admin." });
        }

        // Attach user to request for future use
        req.user = user;

        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token." });
    }
};

export default adminAuth;