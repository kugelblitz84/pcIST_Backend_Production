import express from "express";
import cors from "cors";
import userRouter from "./routes/userRoute.js";
import eventRoutes from "./routes/eventRoutes.js";
import NotificationRouter from "./routes/notificationsRoutes.js";
import chatRoutes from "./routes/chatRoutes.js"; 
const app = express();

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

export default app;