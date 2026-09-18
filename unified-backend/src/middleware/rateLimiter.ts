import { Response, NextFunction } from "express";
import redisClient from "../redis.js";
import { AuthenticatedRequest } from "./auth.js";

/**
 * Redis-backed fixed-window rate limiter for the LLM-backed AI endpoints.
 * These calls cost real money per request (Groq + Cloudinary), so a limiter
 * needs to work across server instances — an in-memory Map wouldn't.
 *
 * Keys on the authenticated user when available, falling back to IP for
 * routes that don't require auth (e.g. before isAuth rejects them).
 */
export function createRateLimiter(options: { windowSeconds: number; max: number; prefix: string }) {
  const { windowSeconds, max, prefix } = options;

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const identity = req.user?.user_id ? `u${req.user.user_id}` : `ip${req.ip}`;
      const key = `ratelimit:${prefix}:${identity}`;

      const count = await redisClient.incr(key);
      if (count === 1) {
        await redisClient.expire(key, windowSeconds);
      }

      if (count > max) {
        res.status(429).json({ message: "Too many requests. Please try again in a few minutes." });
        return;
      }

      next();
    } catch (err) {
      // Redis being unavailable shouldn't take down the whole API —
      // fail open, but log so it can be noticed and fixed.
      console.warn("⚠️ Rate limiter check failed, allowing request:", err);
      next();
    }
  };
}
