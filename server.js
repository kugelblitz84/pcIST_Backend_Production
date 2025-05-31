import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import connectDB from './configs/mongodb.js'
import connectCloudinary from './configs/cloudinary.js'
import userRouter from './routes/userRoute.js'
import eventRoutes from './routes/eventRoutes.js'

const app = express()
const port = process.env.PORT || 4000;

// configs
connectDB();
connectCloudinary();

// CORS Configuration
const allowedOrigins = ['https://pcist-v2.vercel.app']; // your frontend URL

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // If you use cookies/auth headers
}));

// middlewares
app.use(express.json());

// routes
app.use('/api/v1/user', userRouter);
app.use('/api/v1/event', eventRoutes);

app.get('/', (req, res) => {
  res.send("API Working");
});

app.listen(port, () => console.log('Server started on PORT : ' + port));
