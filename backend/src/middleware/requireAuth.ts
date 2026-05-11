import type { RequestHandler } from "express";
import type { Role } from "@prisma/client";
import { verifyToken } from "../lib/jwt.js";

export type AuthedRequest = {
  userId: string;
  role: Role;
};

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthedRequest;
  }
}

export const requireAuth: RequestHandler = (req, res, next) => {
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
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
