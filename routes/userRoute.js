import express from 'express';
import { superAdminLogin, registerMember } from '../controllers/userController.js';

const userRouter = express.Router();

userRouter.post('/super-admin', superAdminLogin);
userRouter.post('/register', registerMember);

export default userRouter;