import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    text: {
      type: String,
      default: ""
    },

    type: {
      type: String,
      enum: ["text", "image", "video", "audio", "file"],
      default: "text"
    },

      image: { type: String 

      },


    reactions: {
      type: Map,
      of: String, // userId -> emoji
      default: {}
    },

    edited: {
      type: Boolean,
      default: false
    },

    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    seen: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);
export default Message;
