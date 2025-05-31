import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import connectDB from './configs/mongodb.js';
import connectCloudinary from './configs/cloudinary.js';
import userRouter from './routes/userRoute.js';
import eventRoutes from './routes/eventRoutes.js';

const app = express();
const port = process.env.PORT || 4000;

// Connect to database and cloud
connectDB();
connectCloudinary();

// Enable CORS for all origins (temporary)
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/v1/user', userRouter);
app.use('/api/v1/event', eventRoutes);

app.get('/', (req, res) => {
  res.send("API Working");
});

app.listen(port, () => {
  console.log('Server started on PORT:', port);
});
