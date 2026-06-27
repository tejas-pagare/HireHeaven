import { Redis } from "@upstash/redis";
import dotenv from "dotenv";

dotenv.config();

/**
 * Upstash Redis client — used for:
 *  - Forgot-password token storage (auth)
 *  - Blog post caching
 *  - Analytics result caching
 *  - Socket.IO online-presence tracking
 */
const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default redisClient;
