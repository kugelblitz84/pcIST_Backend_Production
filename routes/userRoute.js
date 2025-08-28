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
  getUserList,
  updateMembershipStatus,
} from "../controllers/userController.js";
//import { registerForEvent } from "../controllers/eventController.js";
import auth from "../middlewares/auth.js";
import adminAuth from "../middlewares/adminAuth.js";
import { sendPadStatementEmail, listPadStatementHistory, sendPadStatementEmailPuppeteer } from "../controllers/notificationController.js";

const userRouter = express.Router();

userRouter.post("/super-admin", superAdminLogin);
userRouter.post("/register", registerMember);
userRouter.post("/login", login);
userRouter.post("/send-verification-email", auth, sendVerificationEmail);
userRouter.post("/verify-user", auth, verifyUser);
userRouter.post("/send-forgot-password-email", sendForgotPasswordCode);
userRouter.post("/recover-password", recoverPassword);
userRouter.put("/update-profile", auth, updateProfile);
userRouter.post("/get-user-data", getUserData);
userRouter.post("/get-user-list", adminAuth, getUserList);
userRouter.post("/update-membership-status/:id", adminAuth, updateMembershipStatus);
// Pad statement endpoints
userRouter.post("/pad/send", sendPadStatementEmail);
userRouter.post("/pad/send-puppeteer", sendPadStatementEmailPuppeteer);
userRouter.get("/pad/history", listPadStatementHistory);
//userRouter.post("/get-user-data-admin", adminAuth, getUserData);
//userRouter.post("/register-for-event/:id", auth, registerForEvent);

export default userRouter;
