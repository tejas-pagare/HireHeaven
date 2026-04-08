/**
 * JWT Auth middleware for Utils service RAG endpoints.
 * Follows the same isAuth pattern used across all other services.
 */
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { sql } from "./db.js";

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export const isAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Authentication required — no token provided" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SEC as string
    ) as { id: number };

    const users = await sql`SELECT * FROM users WHERE user_id = ${decoded.id}`;

    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid token — user not found" });
    }

    req.user = users[0];
    next();
  } catch (error: any) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
