import express from 'express'
import { notifyAllUsers, notifyOneUser } from '../controllers/notificationController.js';
import adminAuth from '../middlewares/adminAuth.js';

const NotificationRouter = express.Router()

NotificationRouter.post('/notify_all_users', adminAuth, notifyAllUsers);
NotificationRouter.post('/notify_one/:token', adminAuth,  notifyOneUser);

export default NotificationRouter;