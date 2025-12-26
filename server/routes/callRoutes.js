import express from "express";
import { protectRoute } from "../middleware/auth.js"; // ✅ named import
import call from "../models/call.js";

const router = express.Router();

router.get("/", protectRoute, async (req, res) => {
  const calls = await call.find({
    $or: [
      { caller: req.user._id, receiver: req.params.id },
      { receiver: req.user._id, caller: req.params.id }
    ]
  }).sort({ createdAt: -1 });

  res.json({ success: true, calls });
});


export default router;
