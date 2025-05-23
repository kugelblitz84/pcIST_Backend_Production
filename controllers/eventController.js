import events from "../models/eventModel";
const addEvent = async (req, res) => {
  try {
    const { eventName, eventType, date, location, description } = req.body;
    await events.create({
      eventName: eventName,
      EventType: eventType,
      date: date,
      location: location,
      description: description,
    });
    res.status(200).json({ message: "New event created" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const getEvents = async (req, res) => {
  try {
    const allEvents = events.find();
    res.status(200).json({
      message: "These are all the current ongoing events",
      data: allEvents,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const GetOneEventUsingId = async (req, res) => {
  try {
    const eventID = req.params.id;
    const event = await events.findById(eventID)
    if(!event){
        return res.status(404).json({message: "No Event Found"})
    }
    return res.status(200).json({
        message: "Event found",
        data: event
    })
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const updateEvent = async (req, res) => {
    try{
        const eventId = req.params.id
        const { eventName, date, description, location } = req.body;

        // Create an object with only the fields provided
        const updateFields = {};
        if (eventName) updateFields.eventName = eventName;
        if (date) updateFields.date = date;
        if (description) updateFields.description = description;
        if (location) updateFields.location = location;

        // Update the event document
        const updatedEvent = await events.findByIdAndUpdate(
            eventId,
            { $set: updateFields },
            { new: true } // Return the updated document
        );

        if (!updatedEvent) {
            return res.status(404).json({ message: "Event not found" });
        }

        return res.status(200).json({
            message: "Event updated successfully",
            data: updatedEvent
        });

    }catch(e){
        res.status(500).json({message: e.message})
    }
}

const deleteEvent = async (req, res) => {
    try {
        const eventId = req.params.id;

        const deletedEvent = await events.findByIdAndDelete(eventId);

        if (!deletedEvent) {
            return res.status(404).json({ message: "Event not found" });
        }

        return res.status(200).json({
            message: "Event deleted successfully",
            data: deletedEvent
        });

    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

export default {addEvent, getEvents, GetOneEventUsingId, updateEvent, deleteEvent}