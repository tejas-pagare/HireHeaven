import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import app from "./app.js";
import { initDB } from "./db.js";
import redisClient from "./redis.js";
import { setupSocket } from "./socket/handlers.js";
import { warmUpEmbeddings } from "./utils/embedding.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

async function start() {
  // ── 1. Init Database ──────────────────────────────────────────────────────────
  await initDB();

  // ── 2. Verify Redis ───────────────────────────────────────────────────────────
  try {
    await redisClient.set("ping", "pong", { ex: 10 });
    console.log("✅ Connected to Upstash Redis");
  } catch (err) {
    console.warn("⚠️  Redis connection failed:", (err as Error).message);
  }

  // ── 3. Create HTTP Server + Socket.IO ─────────────────────────────────────────
  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // ── 4. Setup Socket Handlers ──────────────────────────────────────────────────
  setupSocket(io);

  // ── 5. Start Server ───────────────────────────────────────────────────────────
  httpServer.listen(PORT, () => {
    console.log(`🚀 Unified backend running on http://localhost:${PORT}`);
    console.log(`🔌 WebSocket server ready`);
    console.log(`📦 Routes:`);
    console.log(`   POST/GET  /api/auth/*`);
    console.log(`   POST/GET  /api/user/*`);
    console.log(`   POST/GET  /api/job/*`);
    console.log(`   POST/GET  /api/payment/*`);
    console.log(`   POST/GET  /api/blog/*`);
    console.log(`   POST/GET  /api/chat/*`);
    console.log(`   POST/GET  /api/utils/*`);
    console.log(`   GET       /health`);

    // Warm up embedding model in background
    warmUpEmbeddings();
  });
}

start().catch((err) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});
