import mongoose from "mongoose";

const messageChema = new mongoose.Schema(
    {
        senderId:{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        text:{
            type: String,
            required: true,
        },
        senderName: {
            type: String,
            required: true,
        },
        sentAt: {
            type: Date,
            default: Date.now,
        },
    }
)

const messagesdModel = mongoose.model("group-messages", messageChema);

export default messagesdModel;