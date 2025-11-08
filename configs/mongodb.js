import mongoose from "mongoose"

const connectDB = async () => {
    
    mongoose.connection.on('connected', () => {
        console.log("DB Connected");
    })
    await mongoose.connect(`${process.env.MONGODB_URI}/pcist`)
    mongoose.connection.on('error', (err) => {
        console.log("DB Connection Error:", err);
    })

}

export default connectDB;