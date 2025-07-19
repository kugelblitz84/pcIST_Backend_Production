import express from 'express'
import cors from 'cors'
import 'dotenv/config'
 import connectDB from './configs/mongodb.js'
// import connectCloudinary from './configs/cloudinary.js'
import userRouter from './routes/userRoute.js'
import eventRoutes from './routes/eventRoutes.js'
import NotificationRouter from './routes/notificationsRoutes.js'

const app = express()
const port = process.env.PORT || 4000;

// configs
connectDB();
// connectCloudinary();

// middlewares
app.use(express.json())
app.use(cors())

// auth route
app.use('/api/v1/user', userRouter);
app.use('/api/v1/event', eventRoutes);
app.use('/api/v1/notification', NotificationRouter);

app.get('/', (req, res)=>{
	res.send("API Working")
})

app.listen(port, ()=> console.log('Server started on PORT : ' + port));
