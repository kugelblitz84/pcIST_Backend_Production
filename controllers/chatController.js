import messagesdModel from "../models/chatModel.js";

const getChatMessages = async (req, res) => {
  try {
    const { limit = 20, skip = 0 } = req.body;

    const messages = await messagesdModel
      .find()
      .sort({ sentAt: -1 }) // newest first
      .skip(Number(skip))
      .limit(Number(limit));
    res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export { getChatMessages };