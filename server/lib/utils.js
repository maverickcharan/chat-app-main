import jwt from 'jsonwebtoken';

// function to generate a token for a user
export const generateToken = (userId) => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not defined in .env");
    }

    // Correct order: payload, secret, options
    const token = jwt.sign(
        { userId },           // payload
        process.env.JWT_SECRET, // secret key
        { expiresIn: "28d" }  // options
    );

    return token;
};
