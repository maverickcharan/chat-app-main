import express from "express";
import "dotenv/config";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

import connectDB from "./lib/db.js";
import userRouter from "./routes/userRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import callRoutes from "./routes/callRoutes.js";

import User from "./models/User.js";
import Message from "./models/Message.js";
import call from "./models/call.js";



const app = express();
const server = http.createServer(app);

/* ================= SOCKET.IO ================= */
export const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

/* ================= GLOBAL STORES ================= */
export const userSocketMap = {}; // userId -> socketId
const activeCalls = {}; // call tracking

/* ================= SOCKET CONNECTION ================= */
io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  console.log("🔌 User connected:", userId);

  if (userId) userSocketMap[userId] = socket.id;
  io.emit("onlineUsers", Object.keys(userSocketMap));

  /* ---------- TYPING ---------- */
  socket.on("typing", ({ to }) => {
    const s = userSocketMap[to];
    if (s) io.to(s).emit("user-typing", { from: userId });
  });

  socket.on("stop-typing", ({ to }) => {
    const s = userSocketMap[to];
    if (s) io.to(s).emit("user-stop-typing", { from: userId });
  });

  /* ---------- MESSAGE SEEN ---------- */
  socket.on("mark-seen", async ({ from }) => {
    await Message.updateMany(
      { senderId: from, receiverId: userId, seen: false },
      { seen: true }
    );

    const senderSocket = userSocketMap[from];
    if (senderSocket) {
      io.to(senderSocket).emit("messages-seen", { by: userId });
    }
  });

  /* ================= CALL SYSTEM ================= */

  // 📞 CALL USER
  socket.on("call-user", async ({ to, offer, callType }) => {
    const receiverSocket = userSocketMap[to];
    if (!receiverSocket) return;

    const call = await call.create({
      caller: userId,
      receiver: to,
      type: callType,
    });

    activeCalls[`${userId}_${to}`] = {
      callId: call._id,
      startTime: Date.now(),
    };

    io.to(receiverSocket).emit("incoming-call", {
      from: userId,
      offer,
      callType,
      callId: call._id,
    });
  });

  // ✅ ANSWER CALL
  socket.on("answer-call", async ({ to, answer }) => {
    const key = `${to}_${userId}`;
    const receiverSocket = userSocketMap[to];

    if (activeCalls[key]) {
      await Call.findByIdAndUpdate(activeCalls[key].callId, {
        status: "accepted",
      });
    }

    if (receiverSocket) {
      io.to(receiverSocket).emit("call-accepted", { answer });
    }
  });

  // ❌ REJECT CALL
  socket.on("reject-call", async ({ to }) => {
    const key = `${to}_${userId}`;
    const receiverSocket = userSocketMap[to];

    if (activeCalls[key]) {
      await Call.findByIdAndUpdate(activeCalls[key].callId, {
        status: "rejected",
        duration: 0,
      });
      delete activeCalls[key];
    }

    if (receiverSocket) io.to(receiverSocket).emit("call-rejected");
  });

  // ❄ ICE CANDIDATE
  socket.on("ice-candidate", ({ to, candidate }) => {
    const s = userSocketMap[to];
    if (s) io.to(s).emit("ice-candidate", { candidate });
  });

  // ☎ END CALL
  socket.on("end-call", async ({ to }) => {
    const key1 = `${userId}_${to}`;
    const key2 = `${to}_${userId}`;
    const data = activeCalls[key1] || activeCalls[key2];
    if (!data) return;

    const duration = Math.floor((Date.now() - data.startTime) / 1000);

    await Call.findByIdAndUpdate(data.callId, {
      status: "ended",
      duration,
    });

    delete activeCalls[key1];
    delete activeCalls[key2];

    const receiverSocket = userSocketMap[to];
    if (receiverSocket) io.to(receiverSocket).emit("call-ended");
  });

  /* ---------- DISCONNECT ---------- */
  socket.on("disconnect", async () => {
    console.log("❌ User disconnected:", userId);

    for (const key in activeCalls) {
      if (key.includes(userId)) {
        await Call.findByIdAndUpdate(activeCalls[key].callId, {
          status: "missed",
          duration: 0,
        });
        delete activeCalls[key];
      }
    }

    if (userId) {
      delete userSocketMap[userId];
      await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
    }

    io.emit("onlineUsers", Object.keys(userSocketMap));
  });
});

/* ================= MIDDLEWARE ================= */
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "4mb" }));

/* ================= ROUTES ================= */
app.use("/api/status", (_, res) => res.send("Server is running"));
app.use("/api/auth", userRouter);
app.use("/api/messages", messageRoutes);
app.use("/api/calls", callRoutes);

/* ================= START SERVER ================= */
const startServer = async () => {
  await connectDB();
  const PORT = process.env.PORT || 5001;
  server.listen(PORT, () =>
    console.log(`🚀 Server running on port ${PORT}`)
  );
};

startServer();
