import express from 'express';
import { superAdminLogin, registerMember, sendVerificationEmail, verifyUser } from '../controllers/userController.js';

const userRouter = express.Router();

userRouter.post('/super-admin', superAdminLogin);
userRouter.post('/register', registerMember);
userRouter.post('/send-verification-email', sendVerificationEmail);
userRouter.post('/verify-user', verifyUser);

export default userRouter;