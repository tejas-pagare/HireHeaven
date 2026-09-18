import IORedis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

/**
 * BullMQ needs a real ioredis connection (blocking commands, Lua scripts) —
 * the Upstash REST client in redis.ts can't do that, it's HTTP-request-per-
 * command. This is a separate, plain TCP Redis connection used only for
 * queueing, kept distinct from the REST client used elsewhere in the app.
 */
export const queueConnection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
