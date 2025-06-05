import mongoose from 'mongoose'

const eventSchema = new mongoose.Schema(
    {
        eventName: {
            type: String,
            required: true,
        },
        eventType: {
            type: String,
            required: true,
        },
        date:{
            type: Date,
            required: true,
        },
        location: {
            type: String,
            requried: true,
        },
        description:{
            type: String,
        },
        image:{
            type: String,
        },
        imagePublicId: {
            type: String,
        }
    },
    {
        minimize: false,
	    timestamps: true
    }
)

const events = mongoose.model('events', eventSchema);

export default events;