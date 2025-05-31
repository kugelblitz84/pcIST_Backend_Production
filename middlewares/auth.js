import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Not Authorized. Login again." });
    }

    const token = authHeader.split(" ")[1];
    const { slug } = req.body;

    if (!token) {
      return res.status(401).json({ message: "Not Authorized. Login again." });
    }

    if (!slug) {
      return res.status(400).json({ message: "Missing email or slug." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Find user by slug
    const user = await userModel.findOne({ slug });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Match email from decoded token and user
    if (decoded.email !== user.email) {
      return res.status(403).json({ message: "Not Authorized. Email mismatch." });
    }

    // Attach user to request for downstream access
    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

export default auth;
