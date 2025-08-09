import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./configs/mongodb.js";
//import connectCloudinary from "./configs/cloudinary.js";
import userRouter from "./routes/userRoute.js";
import eventRoutes from "./routes/eventRoutes.js";
import NotificationRouter from "./routes/notificationsRoutes.js";
import chatRoutes from "./routes/chatRoutes.js"; 
import http from "http";
import { Server } from "socket.io";
import messagesdModel from "./models/chatModel.js";

// comment 2

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 4000;

// Connect to database and cloud
connectDB();

// middlewares
app.use(express.json());
app.use(cors());

// auth route
app.use("/api/v1/user", userRouter);
app.use("/api/v1/event", eventRoutes);
app.use("/api/v1/notification", NotificationRouter);
app.use("/api/v1/chat", chatRoutes);

app.get("/", (req, res) => {
  res.send("API update Working");
});

//app.listen(port, () => console.log("Server started on PORT : " + port));

//socket.io setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Listen for incoming messages
  socket.on("message", async (dataString) => {
    //console.log(`Message from ${socket.id}:`, dataString);
    const data = JSON.parse(dataString);
    try {
      // Store message in DB
      const newMessage = new messagesdModel({
        senderId: data.senderId,
        text: data.text,
        senderName: data.senderName,
        sentAt: data.sentAt || Date.now(),
      });

      await newMessage.save();

      //console.log("Message saved to DB:", newMessage);

      // Broadcast to other clients
      socket.broadcast.emit("message", data);
    } catch (error) {
      console.error("Error saving message:", error);
    }
  });
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

server.listen(port, () => {
  console.log(`Server running on port: ${port}`);
});
