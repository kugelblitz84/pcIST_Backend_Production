import mongoose from "mongoose";

const registeredMembersSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      requried: true,
      ref: "user",
    },
    classroll: {
      type: Number,
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

const registeredTeamSchema = mongoose.Schema({
  teamName: {
    type: String,
    required: true,
  },
  members: [registeredMembersSchema],
});

const soloEventSchema = new mongoose.Schema(
  {
    eventName: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    registrationDeadline: {
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

const teamEventSchema = new mongoose.Schema({
  eventName: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  registrationDeadline: {
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
  needMembership: {
    type: Boolean,
    required: true,
  },
  registeredTeams: [registeredTeamSchema],
});

teamEventSchema.index({ "registeredTeams.members.userId": 1 });
teamEventSchema.index({ "registeredTeams.teamName": 1 });
const gallerySchema = new mongoose.Schema({
  images: [
    {
      url: {
        type: String,
      },
      publicId: {
        type: String,
      },
    },
  ],
});
const teamEvents = mongoose.model("team-events", teamEventSchema);
const soloEvents = mongoose.model("solo-events", soloEventSchema);
const eventGallery = mongoose.model("gallery", gallerySchema);

export { soloEvents, teamEvents, eventGallery };

//done
