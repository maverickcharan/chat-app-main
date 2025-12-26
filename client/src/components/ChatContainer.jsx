import { AuthContext } from "../../context/AuthContext";
import { ChatContext } from "../../context/ChatContext";
import assets from "../assets/assets";
import { formatMessageTime } from "../lib/utils";
import toast from "react-hot-toast";
import React, { useRef, useEffect, useState, useContext } from "react";
import { Phone, Video, Clock } from "lucide-react";
import axios from "axios";
import IncomingCall from "../components/IncomingCall"; // ensure correct path

export function ChatContainer() {
  const {
    messages = [],
    selectedUser,
    setSelectedUser,
    sendMessage,
    getMessages,
    handleTyping,
    isTyping,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    incomingCall,
    currentCallUser,
    callType,
    isCalling,
    localStream,
    remoteStream,
    getCallHistory,
    callHistory,
  } = useContext(ChatContext);

  const { authUser, onlineUsers } = useContext(AuthContext);

  const scrollEnd = useRef(null);
  const [input, setInput] = useState("");

  // Fetch call history when selected user changes
  useEffect(() => {
    if (selectedUser?._id) {
      getMessages(selectedUser._id);
      getCallHistory();
    }
  }, [selectedUser]);

  // Auto-scroll messages
  useEffect(() => {
    scrollEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    await sendMessage({ text: input.trim() });
    setInput("");
  };

  // Send image
  const handleSendImage = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("image/")) return toast.error("Select an image file");

    const reader = new FileReader();
    reader.onloadend = async () => {
      await sendMessage({
        image: reader.result,
        type: "image"
      });

      e.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  if (!selectedUser) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-gray-500 bg-white/10 max-md:hidden">
        <img src={assets.logo_icon} className="max-w-16" alt="" />
        <p className="text-lg font-medium text-white">
          Chat anytime anywhere
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scroll-hide relative backdrop-blur-lg">

      {/* Incoming Call Modal */}
      {incomingCall && (
        <IncomingCall
          call={incomingCall}
          onAccept={acceptCall}
          onReject={rejectCall}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 py-3 mx-4 border-b border-stone-500">
        <img
          src={selectedUser?.profilepic || assets.avatar_icon}
          alt=""
          className="w-8 rounded-full"
        />
        <p className="flex-1 text-lg text-white flex items-center gap-2">
          {selectedUser.fullName}
          {onlineUsers.includes(selectedUser._id) && (
            <span className="w-2 h-2 rounded-full bg-green-500" />
          )}
        </p>

        {/* Call buttons */}
        <div className="flex gap-2">
          <button
            disabled={isCalling}
            onClick={() => startCall(selectedUser, "audio")}
            className="bg-green-500 p-2 rounded-full disabled:opacity-50"
            title="Audio Call"
          >
            <Phone size={18} color="white" />
          </button>

          <button
            disabled={isCalling}
            onClick={() => startCall(selectedUser, "video")}
            className="bg-blue-500 p-2 rounded-full disabled:opacity-50"
            title="Video Call"
          >
            <Video size={18} color="white" />
          </button>
        </div>

        <img
          onClick={() => setSelectedUser(null)}
          src={assets.arrow_icon}
          alt=""
          className="md:hidden max-w-7 cursor-pointer"
        />
      </div>

      {/* Messages + Call History */}
      <div className="flex flex-col h-[calc(100%-120px)] overflow-y-auto p-3 pb-6">
        {/* Messages */}
        {messages.map((msg, index) => {
          const isMe = msg.senderId === authUser._id;
          return (
            <div
              key={index}
              className={`flex items-end gap-2 mb-2 ${isMe ? "justify-end" : "flex-row-reverse justify-end"}`}
            >
              {msg.image ? (
                <img src={msg.image} className="max-w-[230px] rounded-lg border" alt="" />
              ) : (
                <p className={`p-2 max-w-[200px] text-sm rounded-lg break-all text-white ${isMe ? "bg-violet-500/30 rounded-br-none" : "bg-gray-500/30 rounded-bl-none"}`}>
                  {msg.text}
                </p>
              )}

              <div className="text-xs text-center">
                <img
                  src={isMe ? authUser?.profilepic || assets.avatar_icon : selectedUser?.profilepic || assets.avatar_icon}
                  className="w-7 rounded-full"
                  alt=""
                />
                <p className="text-gray-400">{msg.createdAt && formatMessageTime(msg.createdAt)}</p>
              </div>
            </div>
          );
        })}

        {isTyping && <p className="text-xs text-gray-400 ml-2">{selectedUser.fullName} is typing...</p>}

        <div ref={scrollEnd} />

        {/* Call History */}
        {callHistory.length > 0 && (
          <div className="mt-4 border-t border-gray-600 pt-2">
            <p className="text-white text-sm mb-2 font-semibold flex items-center gap-1">
              <Clock size={16} /> Call History
            </p>
            {callHistory.map((call, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center text-sm text-gray-300 mb-1 p-1 rounded hover:bg-gray-700/20 cursor-pointer"
              >
                <p>{call.type.charAt(0).toUpperCase() + call.type.slice(1)} call{call.status ? ` - ${call.status}` : ""}</p>
                <p>{call.duration ? `${call.duration}s` : "-"}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center gap-3 p-3">
        <div className="flex-1 flex items-center bg-gray-100/12 px-3 rounded-full">
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              handleTyping();
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage(e)}
            type="text"
            placeholder="Send a message"
            className="flex-1 text-sm p-3 bg-transparent outline-none text-white"
          />
          <input onChange={handleSendImage} type="file" id="image" accept="image/*" hidden />
          <label htmlFor="image">
            <img src={assets.gallery_icon} className="w-5 mr-2 cursor-pointer" alt="" />
          </label>
        </div>

        <img onClick={handleSendMessage} src={assets.send_button} className="w-7 cursor-pointer" alt="" />
      </div>

      {/* Outgoing Call Overlay */}
      {isCalling && currentCallUser && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 z-50">
          {callType === "video" && (
            <>
              <video autoPlay muted ref={(el) => el && (el.srcObject = localStream)} className="w-32 h-32 rounded-lg border" />
              <video autoPlay ref={(el) => el && (el.srcObject = remoteStream)} className="w-64 h-64 rounded-lg border" />
            </>
          )}
          {callType === "audio" && <p className="text-white text-lg">Audio Call...</p>}
          <button onClick={endCall} className="bg-red-500 px-4 py-2 rounded-lg">
            End Call
          </button>
        </div>
      )}
    </div>
  );
}

export default ChatContainer;
