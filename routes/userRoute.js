import express from "express";
import {
  superAdminLogin,
  registerMember,
  sendVerificationEmail,
  verifyUser,
  sendForgotPasswordCode,
  recoverPassword,
  updateProfile,
  login,
  getUserData,
} from "../controllers/userController.js";
import { registerForEvent } from "../controllers/eventController.js";
import auth from "../middlewares/auth.js";
import adminAuth from "../middlewares/adminAuth.js";

const userRouter = express.Router();

userRouter.post("/super-admin", superAdminLogin);
userRouter.post("/register", registerMember);
userRouter.post("/login", login);
userRouter.post("/send-verification-email", auth, sendVerificationEmail);
userRouter.post("/verify-user", auth, verifyUser);
userRouter.post("/send-forgot-password-email", sendForgotPasswordCode);
userRouter.post("/recover-password", recoverPassword);
userRouter.put("/update-profile", auth, updateProfile);
userRouter.post("/get-user-data", auth, getUserData);
userRouter.post("/get-user-data-admin", adminAuth, getUserData);
userRouter.post("/register-for-event/:id", auth, registerForEvent);

export default userRouter;
