import mongoose from "mongoose";

const registeredMembersSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      requried: true,
      ref: "user",
    },
    Name: {
      type: String,
    },
    paymentStatus: {
      type: Boolean,
    },
  },
  {
    timestamp: true,
  }
);

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
    date: {
      type: Date,
      required: true,
    },
    location: {
      type: String,
      //requried: true,
    },
    description: {
      type: String,
    },
    images: {
      type: [{ url: { type: String }, publicId: { type: String } }],
    },
    // imagePublicId: {
    //     type: [String],
    // },
    needMembership: {
      type: Boolean,
      required: true,
    },
    registeredMembers: [registeredMembersSchema],
  },
  {
    minimize: false,
    timestamps: true,
  }
);

const events = mongoose.model("events", eventSchema);

export default events;
