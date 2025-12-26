import User from "../models/User.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../lib/utils.js";  
import cloudinary from "../lib/cloudinary.js";

// signup a new user
export const signup = async (req, res) => {
    const { fullName, email, password, bio } = req.body;

    try {
        if (!fullName || !email || !password || !bio) {
            return res.json({ success: false, message: "missing details" });
        }

        const user = await User.findOne({ email });

        if (user) {
            return res.json({ success: false, message: "User already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await User.create({
            fullName,
            email,
            password: hashedPassword,
            bio
        });

        const token = generateToken(newUser._id);

        res.json({
            success: true,
            userData: newUser,
            token,
            message: "Account created successfully"
        });

    } catch (error) {
        res.json({
            success: false,
            message: error.message
        });
    }
};

// controller to login a user
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const userData = await User.findOne({ email });

        if (!userData) {
            return res.json({ success: false, message: "Invalid credentials" });
        }

        const isPasswordCorrect = await bcrypt.compare(password, userData.password);

        if (!isPasswordCorrect) {
            return res.json({ success: false, message: "Invalid credentials" });
        }

        const token = generateToken(userData._id);

        res.json({
            success: true,
            userData,
            token,
            message: "Login successfully"
        });

    } catch (error) {
        res.json({
            success: false,
            message: error.message
        });
    }
};

// controller to check is user is authenticated  
export const checkAuth = async (req, res) => {
    res.json({success: true, user: req.user})
}  

//controller to update user profile details
export const updateProfile = async (req, res) => {    
  try {
    const { fullName, bio, profilePic } = req.body;
    const userId = req.user._id;

    // Prepare data to update
    const updateData = { fullName, bio };

    // If there is a new profile image
    if (profilePic) {
      const upload = await cloudinary.uploader.upload(profilePic, {
        folder: "profilePics", // optional
      });
      updateData.profilePic = upload.secure_url;
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,  // important to return updated document
    });

    res.status(200).json({ success: true, user: updatedUser });

  } catch (error) {   
    console.log(error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};


