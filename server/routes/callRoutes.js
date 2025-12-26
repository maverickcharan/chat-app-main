import express from "express";
import Call from "../models/Call.js";
import { protectRoute } from "../middleware/auth.js"; // ✅ named import

const router = express.Router();

router.get("/", protectRoute, async (req, res) => {
  const calls = await Call.find({
    $or: [
      { caller: req.user._id, receiver: req.params.id },
      { receiver: req.user._id, caller: req.params.id }
    ]
  }).sort({ createdAt: -1 });

  res.json({ success: true, calls });
});


export default router;
