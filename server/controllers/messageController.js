import User from "../models/User.js";
import Message from "../models/Message.js";
import cloudinary from "../lib/cloudinary.js";
import { io, userSocketMap } from '../server.js';

export const getUserForSidebar = async (req, res) => {
    try {
        const userId = req.user._id;
        const filteredUsers = await User.find({ _id: { $ne: userId } }).select
            ("-password")

        //Count number of messages not seen   

        const unseenMessageCounts = {}
        const promises = filteredUsers.map(async (user) => {
            const messages = await Message.find({
                senderId: user._id, receiverId:
                    userId, seen: false
            });
            if (messages.length > 0) {
                unseenMessageCounts[user._id] = messages.length;
            }
        });
        await Promise.all(promises);
        res.json({ success: true, users: filteredUsers, unseenMessageCounts });
    } catch (error) {
        console.log(error.message)
        res.json({ success: false, message: error.message });
    }
}

//GEt all message sseelcted users 
export const getMessages = async (req, res) => {
    try {
        const { id: selectedUserId } = req.params;
        const myId = req.user._id;

        const messages = await Message.find({
            $or: [
                { senderId: myId, receiverId: selectedUserId },
                { senderId: selectedUserId, receiverId: myId },
            ],
        });

        // 🔥 BULK SEEN
        await Message.updateMany(
            {
                senderId: selectedUserId,
                receiverId: myId,
                seen: false,
            },
            { $set: { seen: true } }
        );

        // 🔥 notify sender to update unseen count
        const senderSocketId = userSocketMap[selectedUserId];
        if (senderSocketId) {
            io.to(senderSocketId).emit("messages-seen", {
                by: myId,
            });
        }

        res.json({ success: true, messages });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};


//api to mark message as seen using message id
export const markMessageAsSeen = async (req, res) => {
    try {
        const { id } = req.params;
        await Message.findByIdAndUpdate(id, { seen: true });
        res.json({ success: true })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}

//send message to selected user
export const sendMessage = async (req, res) => {
    try {
        const { text, image } = req.body;
        const receiverId = req.params.id;
        const senderId = req.user._id;

        let imageUrl = "";

        if (image) {
            const uploadResponse = await cloudinary.uploader.upload(image, {
                folder: "chat-images",
            });
            imageUrl = uploadResponse.secure_url;
        }

        const newMessage = await Message.create({
            senderId,
            receiverId,
            text,
            image: imageUrl,
            type: image ? "image" : "text",
        });

        const receiverSocketId = userSocketMap[receiverId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("new-message", newMessage);
        }

        res.json({ success: true, newMessage });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

