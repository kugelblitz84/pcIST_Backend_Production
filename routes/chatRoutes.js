import { getChatMessages } from "../controllers/chatController.js";
import express from "express";

const chatRoutes = express.Router();

chatRoutes.post("/get_chat_messages", getChatMessages);

export default chatRoutes;
