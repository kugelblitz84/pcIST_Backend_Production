import "dotenv/config";
import connectDB from "./configs/mongodb.js";
import http from "http";
import { Server } from "socket.io";
import messagesdModel from "./models/chatModel.js";
import app from "./app.js";

const server = http.createServer(app);
const port = process.env.PORT || 4000;

// Connect to database and cloud
connectDB();

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
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
