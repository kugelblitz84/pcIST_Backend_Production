import { soloEvents, teamEvents, eventGallery } from "../models/eventModel.js";
import cloudinary from "../configs/cloudinary.js";
import mongoose from "mongoose";

const addEvent = async (req, res) => {
  try {
    const {
      eventName,
      eventType,
      date,
      registrationDeadline,
      location,
      description,
      needMembership,
    } = req.body;

    const images = req.files;
    let imagesUrl = await Promise.all(
      images.map(async (item) => {
        let result = await cloudinary.uploader.upload(item.path, {
          resource_type: "image",
          folder: "Event banners",
        });
        return {
          url: result.secure_url,
          publicId: result.public_id,
        };
      })
    );

    const newEventData = {
      eventName,
      date,
      registrationDeadline,
      location,
      description,
      images: imagesUrl,
      needMembership,
    };

    if (eventType === "solo") {
      await soloEvents.create({ ...newEventData, registeredMembers: [] });
    } else if (eventType === "team") {
      await teamEvents.create({ ...newEventData, registeredTeams: [] });
    } else {
      return res.status(400).json({ message: "Invalid event type" });
    }

    res.status(200).json({ message: "New event created" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const getEvents = async (req, res) => {
  try {
    const solo = await soloEvents.find();
    const team = await teamEvents.find();
    res.status(200).json({
      message: "All current events",
      soloEvents: solo,
      teamEvents: team,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const GetOneEventUsingId = async (req, res) => {
  try {
    const eventID = req.params.id;

    let event = await soloEvents.findById(eventID);
    if (!event) {
      event = await teamEvents.findById(eventID);
      if (!event) {
        return res.status(404).json({ message: "No Event Found" });
      }
    }

    return res.status(200).json({
      message: "Event found",
      data: event,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const updateEvent = async (req, res) => {
  try {
    const eventId = req.params.id;
    const { eventName, date, description, location, registrationDeadline } = req.body;

    const updateFields = {};
    if (eventName) updateFields.eventName = eventName;
    if (date) updateFields.date = date;
    if (description) updateFields.description = description;
    if (location) updateFields.location = location;
    if (registrationDeadline) updateFields.registrationDeadline = registrationDeadline;

    let updatedEvent = await soloEvents.findByIdAndUpdate(eventId, { $set: updateFields }, { new: true });
    if (!updatedEvent) {
      updatedEvent = await teamEvents.findByIdAndUpdate(eventId, { $set: updateFields }, { new: true });
    }

    if (!updatedEvent) {
      return res.status(404).json({ message: "Event not found" });
    }

    return res.status(200).json({
      message: "Event updated successfully",
      data: updatedEvent,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const eventId = req.params.id;

    let deletedEvent = await soloEvents.findByIdAndDelete(eventId);
    if (!deletedEvent) {
      deletedEvent = await teamEvents.findByIdAndDelete(eventId);
    }

    if (!deletedEvent) {
      return res.status(404).json({ message: "Event not found" });
    }

    return res.status(200).json({
      message: "Event deleted successfully",
      data: deletedEvent,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const registerForSoloEvent = async (req, res) => {
  try {
    const userId = req.user.id;
    const eventId = req.params.id;
    const { Name } = req.body;

    const event = await soloEvents.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (event.registeredMembers.some((m) => m.userId.toString() === userId)) {
      return res.status(400).json({ message: "Already registered" });
    }

    event.registeredMembers.push({ userId, Name, paymentStatus: false });
    await event.save();

    res.status(200).json({ message: "Registered for event" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const registerForTeamEvent = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const eventId = req.params.id;
    const { teamName, members } = req.body;

    if (!teamName || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ message: "Invalid team data" });
    }

    const newMemberIds = members.map((m) => mongoose.Types.ObjectId(m.userId));

    const existing = await teamEvents.findOne({
      _id: eventId,
      "registeredTeams.members.userId": { $in: newMemberIds },
    }).session(session);

    if (existing) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "One or more members already registered" });
    }

    await teamEvents.updateOne(
      { _id: eventId },
      {
        $push: {
          registeredTeams: {
            teamName,
            members,
          },
        },
      }
    ).session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: "Team registered successfully" });
  } catch (e) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: e.message });
  }
};

const uploadImagesToGallery = async (req, res) => {
  try {
    const images = req.files;
    let imagesURL = await Promise.all(
      images.map(async (item) => {
        let result = await cloudinary.uploader.upload(item.path, {
          resource_type: "image",
          folder: "Gallery",
        });
        return {
          url: result.secure_url,
          publicId: result.public_id,
        };
      })
    );
    await eventGallery.create({ images: imagesURL });
    res.status(200).json({ message: "Image(s) uploaded successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error uploading: " + err });
  }
};

export {
  addEvent,
  getEvents,
  GetOneEventUsingId,
  updateEvent,
  deleteEvent,
  registerForSoloEvent,
  registerForTeamEvent,
  uploadImagesToGallery,
};
