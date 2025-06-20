import events from "../models/eventModel.js";
import cloudinary from '../configs/cloudinary.js';

const addEvent = async (req, res) => {
  try {
    const {
      eventName,
      eventType,
      date,
      location,
      description,
      needMembership,
    } = req.body;
    const image1 = req.files.image1 && req.files.image1[0];
    const image2 = req.files.image2 && req.files.image2[0];
    const image3 = req.files.image3 && req.files.image3[0];
    const image4 = req.files.image4 && req.files.image4[0];

    const images = [image1, image2, image3, image4].filter(
      (item) => item !== undefined
    );

    let imagesUrl = await Promise.all(
      images.map(async (item) => {
        let result = await cloudinary.uploader.upload(item.path, {
          resource_type: "image",
        });
        return {
          url: result.secure_url,
          publicId: result.public_id,
        };
      })
    );

    await events.create({
      eventName: eventName,
      eventType: eventType,
      date: date,
      location: location,
      description: description,
      images: imagesUrl,
      //imagePublicId: req.file?.filename,
      needMembership: needMembership,
      registeredMembers: [],
    });
    res.status(200).json({ message: "New event created" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const getEvents = async (req, res) => {
  try {
    const allEvents = await events.find();
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
    const event = await events.findById(eventID);
    if (!event) {
      return res.status(404).json({ message: "No Event Found" });
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
      data: updatedEvent,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const eventId = req.params.id;

    const deletedEvent = await events.findByIdAndDelete(eventId);

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

const registerForEvent = async (req, res) => {
  try {
    const userId = req.user.id; // Authenticated user's ID
    const eventId = req.params.id; // Event ID from URL

    const event = await events.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if user is already registered
    if (event.registeredMembers.includes(userId)) {
      return res
        .status(400)
        .json({ message: "User already registered for this event" });
    }

    // Add user to registeredMembers
    event.registeredMembers.push(userId);
    await event.save();

    res.status(200).json({ message: "User registered for event successfully" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export {
  addEvent,
  getEvents,
  GetOneEventUsingId,
  updateEvent,
  deleteEvent,
  registerForEvent,
};

// const addProduct = async (req, res) => {
//     try {

//         const { name, description, sales, price, category, subCategory, sizes, bestseller } = req.body
//         const discountedPrice = sales ? (price - (price * sales / 100)) : price;

//         const image1 = req.files.image1 && req.files.image1[0]
//         const image2 = req.files.image2 && req.files.image2[0]
//         const image3 = req.files.image3 && req.files.image3[0]
//         const image4 = req.files.image4 && req.files.image4[0]

//         const images = [image1, image2, image3, image4].filter((item)=> item !== undefined)

//         let imagesUrl = await Promise.all(
//             images.map(async (item)=>{
//                 let result = await cloudinary.uploader.upload(item.path, {resource_type:'image'});
//                 return result.secure_url
//             })
//         )

//         const productData= {
//             name,
//             description,
//             category,
//             sales: Number(sales),
//             price: Number(price),
//             discountedPrice,
//             subCategory,
//             bestseller: bestseller === "true" ? true : false,
//             sizes: JSON.parse(sizes),
//             image: imagesUrl,
//             date: Date.now(),
//         }

//         // console.log(productData);

//         const product = new productModel(productData);
//         await product.save()

//         res.json({success: true, message:"Product Added"})
//     } catch (error) {
//         console.log(error);
//         res.json({success:false, message: error.message})
//     }
// }
