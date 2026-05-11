import jwt from "jsonwebtoken";
export function signToken(userId, role) {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error("JWT_SECRET is not set");
    return jwt.sign({ sub: userId, role }, secret, { expiresIn: "7d" });
}
export function verifyToken(token) {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error("JWT_SECRET is not set");
    return jwt.verify(token, secret);
}
