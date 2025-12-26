import { createContext, useContext, useState, useEffect, useRef } from "react";
import { AuthContext } from "./AuthContext";
import axios from "axios";
import toast from "react-hot-toast";

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
    const { socket } = useContext(AuthContext);

    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [unseenMessages, setUnseenMessages] = useState({});
    const [isTyping, setIsTyping] = useState(false);

    // Call states
    const [incomingCall, setIncomingCall] = useState(null);
    const [currentCallUser, setCurrentCallUser] = useState(null);
    const [callType, setCallType] = useState(null);
    const [isCalling, setIsCalling] = useState(false);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);

    const peerRef = useRef(null);
    const typingTimeout = useRef(null);

    // Call history
    const [callHistory, setCallHistory] = useState([]);

    const authHeader = () => ({
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });

    /* ================= USERS & MESSAGES ================= */
    const getUsers = async () => {
        try {
            const { data } = await axios.get("/messages/users", authHeader());
            if (data.success) {
                setUsers(data.users);
                setUnseenMessages(data.unseenMessageCounts || {});
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message);
        }
    };

    const getMessages = async (userId) => {
        try {
            const { data } = await axios.get(`/messages/${userId}`, authHeader());
            if (data.success) setMessages(data.messages);
        } catch (err) {
            toast.error(err.response?.data?.message || err.message);
        }
    };

    const sendMessage = async (messageData) => {
        if (!selectedUser) return toast.error("No user selected");
        try {
            const { data } = await axios.post(
                `/messages/send/${selectedUser._id}`,
                messageData,
                authHeader()
            );
            if (data.success) setMessages((p) => [...p, data.newMessage]);
        } catch (err) {
            toast.error(err.response?.data?.message || err.message);
        }
    };

    /* ================= TYPING ================= */
    const handleTyping = () => {
        if (!socket || !selectedUser) return;

        socket.emit("typing", { to: selectedUser._id });

        clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => {
            socket.emit("stop-typing", { to: selectedUser._id });
        }, 1500);
    };

    /* ================= CALL FUNCTIONS ================= */
    const createPeer = (to) => {
        const peer = new RTCPeerConnection();
        peerRef.current = peer;

        peer.ontrack = (e) => setRemoteStream(e.streams[0]);
        peer.onicecandidate = (e) => {
            if (e.candidate) socket.emit("ice-candidate", { to, candidate: e.candidate });
        };

        return peer;
    };

    const startCall = async (user, type) => {
        setCurrentCallUser(user);
        setCallType(type);
        setIsCalling(true);

        const stream = await navigator.mediaDevices.getUserMedia({ video: type === "video", audio: true });
        setLocalStream(stream);

        const peer = createPeer(user._id);
        stream.getTracks().forEach((t) => peer.addTrack(t, stream));

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        socket.emit("call-user", { to: user._id, offer, callType: type });
    };

    const acceptCall = async () => {
        const { from, offer, callType } = incomingCall;
        setCurrentCallUser(users.find((u) => u._id === from));
        setCallType(callType);
        setIsCalling(true);

        const stream = await navigator.mediaDevices.getUserMedia({ video: callType === "video", audio: true });
        setLocalStream(stream);

        const peer = createPeer(from);
        stream.getTracks().forEach((t) => peer.addTrack(t, stream));

        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        socket.emit("answer-call", { to: from, answer });
        setIncomingCall(null);
    };

    const rejectCall = () => {
        if (incomingCall) socket.emit("reject-call", { to: incomingCall.from });
        setIncomingCall(null);
    };

    const endCall = (emit = true) => {
        peerRef.current?.close();
        localStream?.getTracks().forEach((t) => t.stop());

        if (emit && currentCallUser) socket.emit("end-call", { to: currentCallUser._id });

        setCurrentCallUser(null);
        setCallType(null);
        setIsCalling(false);
        setLocalStream(null);
        setRemoteStream(null);
    };

    /* ================= CALL HISTORY ================= */
    const getCallHistory = async () => {
        try {
            const { data } = await axios.get("/calls", authHeader());
            if (data.success) setCallHistory(data.calls);
        } catch (err) {
            toast.error(err.response?.data?.message || err.message);
        }
    };

    /* ================= SOCKET LISTENERS ================= */
    useEffect(() => {
        if (!socket) return;

        socket.on("new-message", (msg) => {
            if (selectedUser && msg.senderId === selectedUser._id) {
                msg.seen = true;
                axios.put(`/messages/mark/${msg._id}`, {}, authHeader());
                setMessages((p) => [...p, msg]);
            } else {
                setUnseenMessages((p) => ({ ...p, [msg.senderId]: (p[msg.senderId] || 0) + 1 }));
            }
        });

        socket.on("user-typing", ({ from }) => { if (selectedUser?._id === from) setIsTyping(true); });
        socket.on("user-stop-typing", ({ from }) => { if (selectedUser?._id === from) setIsTyping(false); });

        socket.on("incoming-call", (data) => setIncomingCall(data));
        socket.on("call-accepted", async ({ answer }) => await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer)));
        socket.on("ice-candidate", ({ candidate }) => peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate)));
        socket.on("call-rejected", () => { toast.error("Call rejected"); endCall(false); });
        socket.on("call-ended", () => endCall(false));

        return () => socket.removeAllListeners();
    }, [socket, selectedUser]);

    return (
        <ChatContext.Provider
            value={{
                messages,
                users,
                selectedUser,
                setSelectedUser,
                getUsers,
                getMessages,
                sendMessage,
                unseenMessages,
                setUnseenMessages,
                isTyping,
                handleTyping,
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
                callHistory,
                getCallHistory, // ✅ Now properly declared
            }}
        >
            {children}
        </ChatContext.Provider>
    );
};
