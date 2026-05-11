import { verifyToken } from "../lib/jwt.js";
export const requireAuth = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing bearer token" });
        return;
    }
    const token = header.slice(7);
    try {
        const payload = verifyToken(token);
        req.auth = { userId: payload.sub, role: payload.role };
        next();
    }
    catch {
        res.status(401).json({ error: "Invalid or expired token" });
    }
};
