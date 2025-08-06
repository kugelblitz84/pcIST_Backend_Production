import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./configs/mongodb.js";
//import connectCloudinary from "./configs/cloudinary.js";
import userRouter from "./routes/userRoute.js";
import eventRoutes from "./routes/eventRoutes.js";
import NotificationRouter from "./routes/notificationsRoutes.js";
import http from "http";
import { Server } from "socket.io";

// comment 1

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

app.get("/", (req, res) => {
  res.send("API Working");
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

  socket.on("message", (data) => {
    console.log(`Message from ${socket.id}: ${data}`);
    socket.broadcast.emit("message", data);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

server.listen(port, () => {
  console.log(`Server running on port: ${port}`);
});
